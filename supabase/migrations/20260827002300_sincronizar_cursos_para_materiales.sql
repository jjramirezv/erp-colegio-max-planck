-- Repara la relación derivada entre los cursos configurados por grado y cada
-- salón existente. No crea cursos ni datos de muestra: solo completa o
-- actualiza cursos_seccion a partir de cursos_grado.

begin;

update public.cursos_seccion as curso_salon
   set horas_semanales = curso_grado.horas_semanales,
       activo = curso_grado.activo,
       actualizado_en = now()
  from public.secciones as salon
  join public.cursos_grado as curso_grado
    on curso_grado.anio_academico_id = salon.anio_academico_id
   and curso_grado.grado_id = salon.grado_id
 where curso_salon.seccion_id = salon.id
   and curso_salon.asignatura_id = curso_grado.asignatura_id
   and curso_salon.archivado_en is null;

insert into public.cursos_seccion (
  anio_academico_id,
  seccion_id,
  asignatura_id,
  horas_semanales,
  activo
)
select
  curso_grado.anio_academico_id,
  salon.id,
  curso_grado.asignatura_id,
  curso_grado.horas_semanales,
  true
from public.cursos_grado as curso_grado
join public.secciones as salon
  on salon.anio_academico_id = curso_grado.anio_academico_id
 and salon.grado_id = curso_grado.grado_id
 and salon.activo
where curso_grado.activo
  and not exists (
    select 1
      from public.cursos_seccion as existente
     where existente.seccion_id = salon.id
       and existente.asignatura_id = curso_grado.asignatura_id
       and existente.archivado_en is null
  );

commit;
