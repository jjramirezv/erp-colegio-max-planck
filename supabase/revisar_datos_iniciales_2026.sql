-- Paso seguro 1: solo revisa lo que dejó la antigua semilla 2026.
-- Este archivo NO elimina información.

select 'años académicos' as grupo, count(*) as registros
from public.anios_academicos where nombre = '2026'
union all
select 'secciones 2026', count(*)
from public.secciones s join public.anios_academicos a on a.id = s.anio_academico_id
where a.nombre = '2026'
union all
select 'cursos 2026', count(*)
from public.cursos_seccion c join public.anios_academicos a on a.id = c.anio_academico_id
where a.nombre = '2026'
union all
select 'matrículas 2026', count(*)
from public.matriculas_estudiantes m join public.anios_academicos a on a.id = m.anio_academico_id
where a.nombre = '2026'
union all
select 'asignaciones docentes 2026', count(*)
from public.asignaciones_docentes ad
where ad.seccion_id in (
  select s.id from public.secciones s join public.anios_academicos a on a.id = s.anio_academico_id where a.nombre = '2026'
) or ad.curso_seccion_id in (
  select c.id from public.cursos_seccion c join public.anios_academicos a on a.id = c.anio_academico_id where a.nombre = '2026'
)
union all
select 'materiales vinculados 2026', count(*)
from public.materiales_educativos m
where m.seccion_id in (
  select s.id from public.secciones s join public.anios_academicos a on a.id = s.anio_academico_id where a.nombre = '2026'
) or m.curso_seccion_id in (
  select c.id from public.cursos_seccion c join public.anios_academicos a on a.id = c.anio_academico_id where a.nombre = '2026'
);
