-- Tipos de documentos y numeración correlativa institucional.
-- La emisión futura usa bloqueo de fila para impedir números duplicados.

begin;

create table public.documentos_institucionales (
  id bigint generated always as identity primary key,
  nombre text not null,
  serie text not null,
  siguiente_numero bigint not null default 1,
  longitud_numero smallint not null default 6,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint documentos_institucionales_nombre_valido check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 90),
  constraint documentos_institucionales_serie_valida check (upper(btrim(serie)) ~ '^[A-Z0-9][A-Z0-9-]{0,11}$'),
  constraint documentos_institucionales_numero_valido check (siguiente_numero > 0),
  constraint documentos_institucionales_longitud_valida check (longitud_numero between 3 and 10)
);

create unique index documentos_institucionales_nombre_uidx
on public.documentos_institucionales (lower(btrim(nombre)));
create unique index documentos_institucionales_serie_uidx
on public.documentos_institucionales (upper(btrim(serie)));
create index documentos_institucionales_activos_idx
on public.documentos_institucionales (activo, nombre);

create trigger documentos_institucionales_actualizado_en
before update on public.documentos_institucionales
for each row execute function public.establecer_actualizado_en();

alter table public.documentos_institucionales enable row level security;
create policy "autenticados leen documentos institucionales" on public.documentos_institucionales
for select to authenticated using (true);
create policy "direccion administra documentos institucionales" on public.documentos_institucionales
for all to authenticated
using ((select public.rol_portal_actual())::text = 'direccion')
with check ((select public.rol_portal_actual())::text = 'direccion');

grant select, insert, update, delete on public.documentos_institucionales to authenticated;
grant usage, select on sequence public.documentos_institucionales_id_seq to authenticated;

create or replace function public.guardar_documento_institucional(
  documento_id_solicitado bigint,
  nombre_solicitado text,
  serie_solicitada text,
  siguiente_numero_solicitado bigint,
  longitud_numero_solicitada smallint,
  activo_solicitado boolean
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare resultado bigint; numero_actual bigint;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede configurar documentos y correlativos.' using errcode = '42501';
  end if;
  if btrim(coalesce(nombre_solicitado, '')) = '' then raise exception 'Escribe el nombre del documento.' using errcode = '22023'; end if;
  if upper(btrim(coalesce(serie_solicitada, ''))) !~ '^[A-Z0-9][A-Z0-9-]{0,11}$' then
    raise exception 'La serie debe usar entre 1 y 12 letras, números o guiones.' using errcode = '22023';
  end if;
  if coalesce(siguiente_numero_solicitado, 0) < 1 then raise exception 'El próximo número debe ser mayor que cero.' using errcode = '22023'; end if;
  if longitud_numero_solicitada not between 3 and 10 then raise exception 'La cantidad de dígitos debe estar entre 3 y 10.' using errcode = '22023'; end if;
  if exists (select 1 from public.documentos_institucionales where lower(btrim(nombre)) = lower(btrim(nombre_solicitado)) and id <> coalesce(documento_id_solicitado, 0)) then
    raise exception 'Ya existe un documento con ese nombre.' using errcode = '23505';
  end if;
  if exists (select 1 from public.documentos_institucionales where upper(btrim(serie)) = upper(btrim(serie_solicitada)) and id <> coalesce(documento_id_solicitado, 0)) then
    raise exception 'La serie ya está siendo utilizada por otro documento.' using errcode = '23505';
  end if;

  if documento_id_solicitado is null then
    insert into public.documentos_institucionales (nombre, serie, siguiente_numero, longitud_numero, activo)
    values (btrim(nombre_solicitado), upper(btrim(serie_solicitada)), siguiente_numero_solicitado, longitud_numero_solicitada, coalesce(activo_solicitado, true))
    returning id into resultado;
  else
    select siguiente_numero into numero_actual from public.documentos_institucionales where id = documento_id_solicitado for update;
    if numero_actual is null then raise exception 'El documento ya no existe.' using errcode = '22023'; end if;
    if siguiente_numero_solicitado < numero_actual then
      raise exception 'El próximo número no puede ser menor que el correlativo actual.' using errcode = '22023';
    end if;
    update public.documentos_institucionales
    set nombre = btrim(nombre_solicitado), serie = upper(btrim(serie_solicitada)),
        siguiente_numero = siguiente_numero_solicitado, longitud_numero = longitud_numero_solicitada,
        activo = coalesce(activo_solicitado, true)
    where id = documento_id_solicitado returning id into resultado;
  end if;
  return resultado;
end; $$;

create or replace function public.eliminar_documento_institucional(documento_id_solicitado bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar configuraciones documentales.' using errcode = '42501';
  end if;
  if exists (select 1 from public.documentos_institucionales where id = documento_id_solicitado and siguiente_numero > 1) then
    raise exception 'Este documento ya inició su numeración. Desactívalo para conservar la trazabilidad.' using errcode = '23503';
  end if;
  delete from public.documentos_institucionales where id = documento_id_solicitado;
end; $$;

create or replace function public.reservar_correlativo_documento(documento_id_solicitado bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare serie_actual text; numero_actual bigint; longitud_actual smallint; correlativo text;
begin
  if (select public.rol_portal_actual())::text not in ('direccion', 'administrativo') then
    raise exception 'Tu cuenta no puede emitir documentos institucionales.' using errcode = '42501';
  end if;
  select serie, siguiente_numero, longitud_numero into serie_actual, numero_actual, longitud_actual
  from public.documentos_institucionales where id = documento_id_solicitado and activo for update;
  if serie_actual is null then raise exception 'El documento no está disponible para emisión.' using errcode = '22023'; end if;
  correlativo := serie_actual || '-' || lpad(numero_actual::text, longitud_actual, '0');
  update public.documentos_institucionales set siguiente_numero = numero_actual + 1 where id = documento_id_solicitado;
  return correlativo;
end; $$;

revoke all on function public.guardar_documento_institucional(bigint, text, text, bigint, smallint, boolean),
  public.eliminar_documento_institucional(bigint), public.reservar_correlativo_documento(bigint) from public, anon;
grant execute on function public.guardar_documento_institucional(bigint, text, text, bigint, smallint, boolean),
  public.eliminar_documento_institucional(bigint), public.reservar_correlativo_documento(bigint) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.documentos_institucionales;
  end if;
exception when duplicate_object then null;
end $$;

commit;
