-- Catálogo institucional reutilizable por procesos académicos, financieros,
-- documentarios y de servicios. No contiene importes ni datos precargados.

begin;

create table public.conceptos_institucionales (
  id bigint generated always as identity primary key,
  nombre text not null,
  categoria text not null check (categoria in ('academico', 'financiero', 'documentario', 'servicio')),
  descripcion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint conceptos_institucionales_nombre_valido check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 90),
  constraint conceptos_institucionales_descripcion_valida check (descripcion is null or char_length(btrim(descripcion)) <= 240)
);

create unique index conceptos_institucionales_nombre_uidx
on public.conceptos_institucionales (lower(btrim(nombre)));
create index conceptos_institucionales_categoria_activo_idx
on public.conceptos_institucionales (categoria, activo, nombre);

create trigger conceptos_institucionales_actualizado_en
before update on public.conceptos_institucionales
for each row execute function public.establecer_actualizado_en();

alter table public.conceptos_institucionales enable row level security;
create policy "autenticados leen conceptos institucionales" on public.conceptos_institucionales
for select to authenticated using (true);
create policy "direccion administra conceptos institucionales" on public.conceptos_institucionales
for all to authenticated
using ((select public.rol_portal_actual())::text = 'direccion')
with check ((select public.rol_portal_actual())::text = 'direccion');

grant select, insert, update, delete on public.conceptos_institucionales to authenticated;
grant usage, select on sequence public.conceptos_institucionales_id_seq to authenticated;

create or replace function public.guardar_concepto_institucional(
  concepto_id_solicitado bigint,
  nombre_solicitado text,
  categoria_solicitada text,
  descripcion_solicitada text,
  activo_solicitado boolean
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare resultado bigint;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los conceptos institucionales.' using errcode = '42501';
  end if;
  if btrim(coalesce(nombre_solicitado, '')) = '' then
    raise exception 'Escribe el nombre del concepto.' using errcode = '22023';
  end if;
  if categoria_solicitada not in ('academico', 'financiero', 'documentario', 'servicio') then
    raise exception 'Selecciona una categoría válida.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.conceptos_institucionales
    where lower(btrim(nombre)) = lower(btrim(nombre_solicitado))
      and id <> coalesce(concepto_id_solicitado, 0)
  ) then
    raise exception 'Ya existe un concepto con ese nombre.' using errcode = '23505';
  end if;

  if concepto_id_solicitado is null then
    insert into public.conceptos_institucionales (nombre, categoria, descripcion, activo)
    values (btrim(nombre_solicitado), categoria_solicitada, nullif(btrim(descripcion_solicitada), ''), coalesce(activo_solicitado, true))
    returning id into resultado;
  else
    update public.conceptos_institucionales
    set nombre = btrim(nombre_solicitado), categoria = categoria_solicitada,
        descripcion = nullif(btrim(descripcion_solicitada), ''), activo = coalesce(activo_solicitado, true)
    where id = concepto_id_solicitado returning id into resultado;
  end if;
  if resultado is null then raise exception 'El concepto ya no existe.' using errcode = '22023'; end if;
  return resultado;
end; $$;

create or replace function public.eliminar_concepto_institucional(concepto_id_solicitado bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar conceptos institucionales.' using errcode = '42501';
  end if;
  delete from public.conceptos_institucionales where id = concepto_id_solicitado;
end; $$;

revoke all on function public.guardar_concepto_institucional(bigint, text, text, text, boolean),
  public.eliminar_concepto_institucional(bigint) from public, anon;
grant execute on function public.guardar_concepto_institucional(bigint, text, text, text, boolean),
  public.eliminar_concepto_institucional(bigint) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.conceptos_institucionales;
  end if;
exception when duplicate_object then null;
end $$;

commit;
