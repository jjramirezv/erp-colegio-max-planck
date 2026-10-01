-- Justificaciones de ausencias y tardanzas. No crea datos de demostracion.

begin;

create table public.justificaciones_asistencia (
  id bigint generated always as identity primary key,
  asistencia_id bigint not null unique references public.asistencias_estudiantes(id) on delete restrict,
  motivo text not null check (motivo in ('salud', 'cita_medica', 'familiar', 'transporte', 'otro')),
  detalle text,
  archivo_ruta text,
  archivo_nombre text,
  archivo_mime text,
  archivo_tamano bigint,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  presentado_por uuid references public.perfiles(id) on delete set null,
  revisado_por uuid references public.perfiles(id) on delete set null,
  observacion_revision text,
  presentado_en timestamptz not null default now(),
  revisado_en timestamptz,
  actualizado_en timestamptz not null default now(),
  constraint justificaciones_detalle_valido check (detalle is null or char_length(btrim(detalle)) between 1 and 500),
  constraint justificaciones_archivo_valido check (
    (archivo_ruta is null and archivo_nombre is null and archivo_mime is null and archivo_tamano is null)
    or (archivo_ruta is not null and archivo_nombre is not null and archivo_mime in ('application/pdf','image/jpeg','image/png') and archivo_tamano between 1 and 8388608)
  ),
  constraint justificaciones_revision_valida check (
    observacion_revision is null or char_length(btrim(observacion_revision)) between 1 and 300
  )
);

create index justificaciones_estado_idx on public.justificaciones_asistencia(estado, presentado_en desc);

create trigger justificaciones_establecer_actualizado_en
before update on public.justificaciones_asistencia
for each row execute function public.establecer_actualizado_en();

alter table public.justificaciones_asistencia enable row level security;

create policy "gestores leen justificaciones"
on public.justificaciones_asistencia for select to authenticated
using (
  (select public.es_gestor_materiales())
  or exists (
    select 1 from public.asistencias_estudiantes ae
    join public.matriculas_estudiantes me on me.id = ae.matricula_id
    where ae.id = asistencia_id
      and (me.estudiante_id = (select auth.uid()) or (select public.docente_tiene_seccion(me.seccion_id)))
  )
);

create or replace function public.guardar_justificacion_asistencia(
  asistencia_id_solicitada bigint,
  motivo_solicitado text,
  detalle_solicitado text,
  archivo_ruta_solicitada text,
  archivo_nombre_solicitado text,
  archivo_mime_solicitado text,
  archivo_tamano_solicitado bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  resultado bigint;
  estado_actual text;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'Solo Direccion o Coordinacion Academica pueden registrar justificaciones.' using errcode = '42501';
  end if;
  if motivo_solicitado not in ('salud', 'cita_medica', 'familiar', 'transporte', 'otro') then
    raise exception 'Selecciona un motivo valido.' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(detalle_solicitado), '')) > 500 then
    raise exception 'El detalle no puede superar 500 caracteres.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.asistencias_estudiantes ae
    join public.matriculas_estudiantes me on me.id = ae.matricula_id
    join public.anios_academicos aa on aa.id = me.anio_academico_id
    where ae.id = asistencia_id_solicitada
      and ae.estado in ('tardanza', 'ausente')
      and aa.estado <> 'cerrado'
  ) then
    raise exception 'La incidencia no existe o su ano lectivo esta cerrado.' using errcode = '22023';
  end if;

  select estado into estado_actual from public.justificaciones_asistencia where asistencia_id = asistencia_id_solicitada for update;
  if estado_actual is not null and estado_actual <> 'pendiente' then
    raise exception 'Una justificacion resuelta ya no se puede modificar.' using errcode = '22023';
  end if;

  insert into public.justificaciones_asistencia (
    asistencia_id, motivo, detalle, archivo_ruta, archivo_nombre, archivo_mime, archivo_tamano, presentado_por
  ) values (
    asistencia_id_solicitada, motivo_solicitado, nullif(btrim(detalle_solicitado), ''), archivo_ruta_solicitada,
    archivo_nombre_solicitado, archivo_mime_solicitado, archivo_tamano_solicitado, auth.uid()
  )
  on conflict (asistencia_id) do update set
    motivo = excluded.motivo,
    detalle = excluded.detalle,
    archivo_ruta = coalesce(excluded.archivo_ruta, public.justificaciones_asistencia.archivo_ruta),
    archivo_nombre = coalesce(excluded.archivo_nombre, public.justificaciones_asistencia.archivo_nombre),
    archivo_mime = coalesce(excluded.archivo_mime, public.justificaciones_asistencia.archivo_mime),
    archivo_tamano = coalesce(excluded.archivo_tamano, public.justificaciones_asistencia.archivo_tamano),
    presentado_por = auth.uid(),
    presentado_en = now()
  returning id into resultado;
  return resultado;
end;
$$;

create or replace function public.resolver_justificacion_asistencia(
  justificacion_id_solicitada bigint,
  decision_solicitada text,
  observacion_solicitada text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'Solo Direccion o Coordinacion Academica pueden resolver justificaciones.' using errcode = '42501';
  end if;
  if decision_solicitada not in ('aprobada', 'rechazada') then
    raise exception 'Selecciona una decision valida.' using errcode = '22023';
  end if;
  if decision_solicitada = 'rechazada' and btrim(coalesce(observacion_solicitada, '')) = '' then
    raise exception 'Indica el motivo del rechazo.' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(observacion_solicitada), '')) > 300 then
    raise exception 'La observacion no puede superar 300 caracteres.' using errcode = '22023';
  end if;
  update public.justificaciones_asistencia set
    estado = decision_solicitada,
    observacion_revision = nullif(btrim(observacion_solicitada), ''),
    revisado_por = auth.uid(),
    revisado_en = now()
  where id = justificacion_id_solicitada and estado = 'pendiente';
  if not found then raise exception 'La justificacion ya fue resuelta o no existe.' using errcode = '22023'; end if;
end;
$$;

revoke all on table public.justificaciones_asistencia from public, anon;
grant select on table public.justificaciones_asistencia to authenticated;
revoke all on function public.guardar_justificacion_asistencia(bigint,text,text,text,text,text,bigint), public.resolver_justificacion_asistencia(bigint,text,text) from public, anon;
grant execute on function public.guardar_justificacion_asistencia(bigint,text,text,text,text,text,bigint), public.resolver_justificacion_asistencia(bigint,text,text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-justifications', 'attendance-justifications', false, 8388608, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "gestores leen sustentos de asistencia" on storage.objects for select to authenticated
using (bucket_id = 'attendance-justifications' and (select public.es_gestor_materiales()));
create policy "gestores suben sustentos de asistencia" on storage.objects for insert to authenticated
with check (bucket_id = 'attendance-justifications' and (select public.es_gestor_materiales()));
create policy "gestores eliminan sustentos de asistencia" on storage.objects for delete to authenticated
using (bucket_id = 'attendance-justifications' and (select public.es_gestor_materiales()));

do $$
begin
  alter publication supabase_realtime add table public.justificaciones_asistencia;
exception when duplicate_object then null;
end $$;

commit;
