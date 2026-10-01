-- Registro diario de asistencia para Coordinacion Academica.
-- No inserta datos de ejemplo.

begin;

create table public.asistencias_estudiantes (
  id bigint generated always as identity primary key,
  matricula_id bigint not null references public.matriculas_estudiantes(id) on delete restrict,
  fecha date not null,
  estado text not null check (estado in ('presente', 'tardanza', 'ausente')),
  minutos_tardanza smallint,
  observacion text,
  registrado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint asistencias_matricula_fecha_key unique (matricula_id, fecha),
  constraint asistencias_tardanza_valida check (
    (estado = 'tardanza' and minutos_tardanza between 1 and 240)
    or (estado <> 'tardanza' and minutos_tardanza is null)
  ),
  constraint asistencias_observacion_valida check (
    observacion is null or char_length(btrim(observacion)) between 1 and 240
  )
);

create index asistencias_fecha_idx on public.asistencias_estudiantes(fecha);

create trigger asistencias_establecer_actualizado_en
before update on public.asistencias_estudiantes
for each row execute function public.establecer_actualizado_en();

alter table public.asistencias_estudiantes enable row level security;

create policy "gestores leen asistencias"
on public.asistencias_estudiantes for select to authenticated
using (
  (select public.es_gestor_materiales())
  or exists (
    select 1 from public.matriculas_estudiantes m
    where m.id = matricula_id
      and (m.estudiante_id = (select auth.uid()) or (select public.docente_tiene_seccion(m.seccion_id)))
  )
);

create policy "gestores registran asistencias"
on public.asistencias_estudiantes for insert to authenticated
with check ((select public.es_gestor_materiales()) and registrado_por = (select auth.uid()));

create policy "gestores actualizan asistencias"
on public.asistencias_estudiantes for update to authenticated
using ((select public.es_gestor_materiales()))
with check ((select public.es_gestor_materiales()) and actualizado_por = (select auth.uid()));

create or replace function public.guardar_asistencia_diaria(
  seccion_id_solicitada bigint,
  fecha_solicitada date,
  registros_solicitados jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  registro jsonb;
  matricula_solicitada bigint;
  estado_solicitado text;
  minutos_solicitados smallint;
  observacion_solicitada text;
  anio_inicio date;
  anio_fin date;
  anio_estado text;
  total integer := 0;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'Solo Direccion o Coordinacion Academica pueden registrar asistencia.' using errcode = '42501';
  end if;

  select a.inicia_en, a.termina_en, a.estado
    into anio_inicio, anio_fin, anio_estado
  from public.secciones s
  join public.anios_academicos a on a.id = s.anio_academico_id
  where s.id = seccion_id_solicitada and s.activo;

  if anio_inicio is null then
    raise exception 'El salon seleccionado no esta disponible.' using errcode = '22023';
  end if;
  if anio_estado = 'cerrado' then
    raise exception 'El ano lectivo cerrado es solo de consulta.' using errcode = '22023';
  end if;
  if fecha_solicitada is null or fecha_solicitada < anio_inicio or fecha_solicitada > anio_fin then
    raise exception 'La fecha debe pertenecer al ano lectivo seleccionado.' using errcode = '22023';
  end if;
  if fecha_solicitada > ((now() at time zone 'America/Lima')::date) then
    raise exception 'No se puede registrar asistencia en una fecha futura.' using errcode = '22023';
  end if;
  if jsonb_typeof(registros_solicitados) <> 'array' or jsonb_array_length(registros_solicitados) = 0 then
    raise exception 'Registra al menos un estudiante.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(seccion_id_solicitada::integer, (fecha_solicitada - date '2000-01-01')::integer);

  for registro in select value from jsonb_array_elements(registros_solicitados)
  loop
    matricula_solicitada := nullif(registro->>'enrollmentId', '')::bigint;
    estado_solicitado := registro->>'status';
    minutos_solicitados := nullif(registro->>'lateMinutes', '')::smallint;
    observacion_solicitada := nullif(btrim(registro->>'note'), '');

    if not exists (
      select 1 from public.matriculas_estudiantes m
      where m.id = matricula_solicitada
        and m.seccion_id = seccion_id_solicitada
        and m.estado = 'active'
        and m.archivado_en is null
    ) then
      raise exception 'Una matricula no pertenece al salon seleccionado.' using errcode = '22023';
    end if;
    if estado_solicitado not in ('presente', 'tardanza', 'ausente') then
      raise exception 'Selecciona un estado valido para cada estudiante.' using errcode = '22023';
    end if;
    if estado_solicitado = 'tardanza' and coalesce(minutos_solicitados, 0) not between 1 and 240 then
      raise exception 'Indica entre 1 y 240 minutos de tardanza.' using errcode = '22023';
    end if;
    if char_length(coalesce(observacion_solicitada, '')) > 240 then
      raise exception 'La observacion no puede superar 240 caracteres.' using errcode = '22023';
    end if;

    insert into public.asistencias_estudiantes (
      matricula_id, fecha, estado, minutos_tardanza, observacion, registrado_por, actualizado_por
    ) values (
      matricula_solicitada,
      fecha_solicitada,
      estado_solicitado,
      case when estado_solicitado = 'tardanza' then minutos_solicitados else null end,
      observacion_solicitada,
      auth.uid(),
      auth.uid()
    )
    on conflict (matricula_id, fecha) do update set
      estado = excluded.estado,
      minutos_tardanza = excluded.minutos_tardanza,
      observacion = excluded.observacion,
      actualizado_por = auth.uid();
    total := total + 1;
  end loop;

  return total;
end;
$$;

revoke all on table public.asistencias_estudiantes from public, anon;
grant select, insert, update on table public.asistencias_estudiantes to authenticated;
grant usage, select on sequence public.asistencias_estudiantes_id_seq to authenticated;
revoke all on function public.guardar_asistencia_diaria(bigint, date, jsonb) from public, anon;
grant execute on function public.guardar_asistencia_diaria(bigint, date, jsonb) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.asistencias_estudiantes;
exception when duplicate_object then null;
end $$;

commit;
