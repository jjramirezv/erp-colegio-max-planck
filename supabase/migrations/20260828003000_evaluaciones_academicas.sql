-- Planificación de evaluaciones por curso y periodo académico.
-- No inserta datos de demostración.

begin;

create table public.evaluaciones_academicas (
  id bigint generated always as identity primary key,
  curso_seccion_id bigint not null references public.cursos_seccion(id) on delete restrict,
  periodo_academico_id bigint not null references public.periodos_academicos(id) on delete restrict,
  titulo text not null,
  tipo text not null,
  descripcion text,
  fecha_aplicacion date not null,
  estado text not null default 'borrador',
  visible_estudiantes boolean not null default false,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint evaluaciones_titulo_valido check (char_length(btrim(titulo)) between 1 and 120),
  constraint evaluaciones_tipo_valido check (tipo in ('diagnostica','formativa','sumativa','practica','proyecto','examen')),
  constraint evaluaciones_descripcion_valida check (descripcion is null or char_length(btrim(descripcion)) between 1 and 500),
  constraint evaluaciones_estado_valido check (estado in ('borrador','programada','en_curso','cerrada'))
);

create unique index evaluaciones_curso_periodo_titulo_uidx
  on public.evaluaciones_academicas (curso_seccion_id, periodo_academico_id, lower(btrim(titulo)))
  where archivado_en is null;
create index evaluaciones_curso_fecha_idx
  on public.evaluaciones_academicas (curso_seccion_id, fecha_aplicacion)
  where archivado_en is null;
create index evaluaciones_periodo_estado_idx
  on public.evaluaciones_academicas (periodo_academico_id, estado)
  where archivado_en is null;

create trigger evaluaciones_establecer_actualizado_en
before update on public.evaluaciones_academicas
for each row execute function public.establecer_actualizado_en();

alter table public.evaluaciones_academicas enable row level security;

create policy "gestores y docentes leen evaluaciones"
on public.evaluaciones_academicas for select to authenticated
using (
  (select public.es_gestor_materiales())
  or exists (
    select 1 from public.asignaciones_docentes ad
    where ad.curso_seccion_id = evaluaciones_academicas.curso_seccion_id
      and ad.docente_id = (select auth.uid())
      and ad.activo and ad.archivado_en is null
  )
  or (
    visible_estudiantes
    and exists (
      select 1
      from public.cursos_seccion cs
      join public.matriculas_estudiantes me on me.seccion_id = cs.seccion_id
      where cs.id = evaluaciones_academicas.curso_seccion_id
        and me.estudiante_id = (select auth.uid())
        and me.estado = 'active' and me.archivado_en is null
    )
  )
);

create or replace function public.guardar_evaluacion_academica(
  evaluacion_id_solicitada bigint,
  curso_seccion_id_solicitado bigint,
  periodo_academico_id_solicitado bigint,
  titulo_solicitado text,
  tipo_solicitado text,
  descripcion_solicitada text,
  fecha_aplicacion_solicitada date,
  estado_solicitado text,
  visible_estudiantes_solicitado boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  resultado bigint;
  anio_curso bigint;
  anio_periodo bigint;
  fecha_inicio date;
  fecha_fin date;
  estado_anio text;
  estado_actual text;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'Solo Dirección o Coordinación Académica pueden gestionar evaluaciones.' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(titulo_solicitado, ''))) not between 1 and 120 then
    raise exception 'El nombre de la evaluación debe tener hasta 120 caracteres.' using errcode = '22023';
  end if;
  if tipo_solicitado not in ('diagnostica','formativa','sumativa','practica','proyecto','examen') then
    raise exception 'Selecciona un tipo de evaluación válido.' using errcode = '22023';
  end if;
  if estado_solicitado not in ('borrador','programada','en_curso','cerrada') then
    raise exception 'Selecciona un estado válido.' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(descripcion_solicitada), '')) > 500 then
    raise exception 'La descripción no puede superar 500 caracteres.' using errcode = '22023';
  end if;

  select cs.anio_academico_id, aa.estado
    into anio_curso, estado_anio
  from public.cursos_seccion cs
  join public.anios_academicos aa on aa.id = cs.anio_academico_id
  where cs.id = curso_seccion_id_solicitado
    and cs.activo and cs.archivado_en is null;
  if anio_curso is null then raise exception 'El curso seleccionado no está disponible.' using errcode = '22023'; end if;
  if estado_anio = 'cerrado' then raise exception 'El año lectivo cerrado es solo de consulta.' using errcode = '22023'; end if;

  select pa.anio_academico_id, pa.inicia_en, pa.termina_en
    into anio_periodo, fecha_inicio, fecha_fin
  from public.periodos_academicos pa
  where pa.id = periodo_academico_id_solicitado;
  if anio_periodo is null or anio_periodo <> anio_curso then
    raise exception 'El periodo no pertenece al año lectivo del curso.' using errcode = '22023';
  end if;
  if fecha_aplicacion_solicitada is null or fecha_aplicacion_solicitada < fecha_inicio or fecha_aplicacion_solicitada > fecha_fin then
    raise exception 'La fecha de aplicación debe encontrarse dentro del periodo seleccionado.' using errcode = '22023';
  end if;

  if evaluacion_id_solicitada is not null then
    select estado into estado_actual
    from public.evaluaciones_academicas
    where id = evaluacion_id_solicitada and archivado_en is null
    for update;
    if estado_actual is null then raise exception 'La evaluación no existe o fue archivada.' using errcode = '22023'; end if;
    if estado_actual = 'cerrada' then raise exception 'Una evaluación cerrada ya no puede modificarse.' using errcode = '22023'; end if;
  end if;

  if evaluacion_id_solicitada is null then
    insert into public.evaluaciones_academicas (
      curso_seccion_id, periodo_academico_id, titulo, tipo, descripcion,
      fecha_aplicacion, estado, visible_estudiantes, creado_por, actualizado_por
    ) values (
      curso_seccion_id_solicitado, periodo_academico_id_solicitado, btrim(titulo_solicitado), tipo_solicitado,
      nullif(btrim(descripcion_solicitada), ''), fecha_aplicacion_solicitada, estado_solicitado,
      coalesce(visible_estudiantes_solicitado, false) and estado_solicitado <> 'borrador', auth.uid(), auth.uid()
    ) returning id into resultado;
  else
    update public.evaluaciones_academicas set
      curso_seccion_id = curso_seccion_id_solicitado,
      periodo_academico_id = periodo_academico_id_solicitado,
      titulo = btrim(titulo_solicitado),
      tipo = tipo_solicitado,
      descripcion = nullif(btrim(descripcion_solicitada), ''),
      fecha_aplicacion = fecha_aplicacion_solicitada,
      estado = estado_solicitado,
      visible_estudiantes = coalesce(visible_estudiantes_solicitado, false) and estado_solicitado <> 'borrador',
      actualizado_por = auth.uid()
    where id = evaluacion_id_solicitada
    returning id into resultado;
  end if;
  return resultado;
end;
$$;

create or replace function public.archivar_evaluacion_academica(evaluacion_id_solicitada bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'Solo Dirección o Coordinación Académica pueden archivar evaluaciones.' using errcode = '42501';
  end if;
  update public.evaluaciones_academicas
    set archivado_en = now(), archivado_por = auth.uid(), actualizado_por = auth.uid()
  where id = evaluacion_id_solicitada and archivado_en is null and estado <> 'cerrada';
  if not found then raise exception 'La evaluación está cerrada, archivada o no existe.' using errcode = '22023'; end if;
end;
$$;

revoke all on table public.evaluaciones_academicas from public, anon, authenticated;
grant select on table public.evaluaciones_academicas to authenticated;
revoke all on sequence public.evaluaciones_academicas_id_seq from public, anon, authenticated;
revoke all on function public.guardar_evaluacion_academica(bigint,bigint,bigint,text,text,text,date,text,boolean), public.archivar_evaluacion_academica(bigint) from public, anon;
grant execute on function public.guardar_evaluacion_academica(bigint,bigint,bigint,text,text,text,date,text,boolean), public.archivar_evaluacion_academica(bigint) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'evaluaciones_academicas'
     ) then
    alter publication supabase_realtime add table public.evaluaciones_academicas;
  end if;
end $$;

commit;
