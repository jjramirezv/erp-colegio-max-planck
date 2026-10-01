-- Ejecutar completo en SQL Editor del proyecto Supabase conectado al ERP,
-- con la cuenta administradora del proyecto. Solo lectura.
-- No cambia cuentas, asignaciones, fechas ni permisos.
-- Cambia 'Jelibeth' en el filtro si deseas revisar a otro docente.

-- 1. Si panel_instalado es false, falta la migración
-- 20260921003100_panel_docente_real.sql (y sus dependencias).
select
  (now() at time zone 'America/Lima')::date as fecha_actual_lima,
  to_regprocedure('public.cargar_panel_docente()') is not null as panel_instalado,
  to_regprocedure('public.docente_tiene_curso(bigint)') is not null as permisos_instalados;

-- 2. Conserva todas las coincidencias, incluso perfiles sin asignación.
-- Compara correo_inicio_sesion con el correo usado para ingresar al portal.
-- Los motivos reproducen los filtros del código local; no invocamos
-- docente_tiene_curso() como administrador porque usa auth.uid() de la sesión.
with contexto as (
  select (now() at time zone 'America/Lima')::date as hoy
), revision as (
  select
    p.id as perfil_id,
    p.nombre_completo as docente,
    u.email as correo_inicio_sesion,
    p.rol as rol_perfil,
    p.activo as perfil_activo,
    ta.id as asignacion_id,
    case when ta.seccion_id is not null then 'Salón completo'
         when ta.curso_seccion_id is not null then 'Curso' end as tipo_asignacion,
    coalesce(c.nombre_visible, a.nombre) as curso,
    concat_ws(' · ', n.nombre, g.nombre, s.nombre) as salon,
    y.nombre as anio_lectivo,
    y.estado as estado_anio,
    y.activo as anio_activo,
    ta.inicia_en,
    ta.termina_en,
    array_remove(array[
      case when u.id is null then 'El perfil no tiene una cuenta Auth vinculada' end,
      case when not p.activo then 'Perfil inactivo' end,
      case when p.rol::text <> 'docente' then 'El perfil no tiene rol docente' end,
      case when ta.id is null then 'No hay asignaciones guardadas para este perfil' end,
      case when not ta.activo or ta.archivado_en is not null then 'Asignación inactiva o archivada' end,
      case when ta.inicia_en > x.hoy then 'La vigencia de la asignación todavía no comienza' end,
      case when ta.termina_en < x.hoy then 'La vigencia de la asignación terminó' end,
      case when not y.activo then 'El año lectivo no está activo' end,
      case when not s.activo then 'El salón está inactivo' end,
      case when not c.activo or c.archivado_en is not null then 'El curso está inactivo o archivado' end,
      case when ta.seccion_id is not null then 'El panel actual solo lista cursos; omite asignaciones por salón' end
    ], null) as motivos
  from public.perfiles p
  left join auth.users u on u.id = p.id
  left join public.asignaciones_docentes ta on ta.docente_id = p.id
  left join public.cursos_seccion c on c.id = ta.curso_seccion_id
  left join public.asignaturas a on a.id = c.asignatura_id
  left join public.secciones s on s.id = coalesce(ta.seccion_id, c.seccion_id)
  left join public.grados g on g.id = s.grado_id
  left join public.niveles_educativos n on n.id = g.nivel_id
  left join public.anios_academicos y on y.id = s.anio_academico_id
  cross join contexto x
  where p.nombre_completo ilike '%Jelibeth%'
)
select *,
  case when cardinality(motivos) = 0
    then 'Cumple los filtros locales: comprobar panel_instalado y correo de inicio de sesión'
    else array_to_string(motivos, '; ')
  end as diagnostico
from revision
order by docente, anio_lectivo, asignacion_id;

-- Si no devuelve filas, el nombre no coincide o estás en otro proyecto.
-- No vuelvas a asignar ni cambies fechas hasta revisar el diagnóstico.
