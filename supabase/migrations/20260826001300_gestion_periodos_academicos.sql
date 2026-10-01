-- Gestión de periodos académicos por año lectivo.
-- No inserta periodos ni información de demostración.

begin;

create table if not exists public.periodos_academicos (
  id bigint generated always as identity primary key,
  anio_academico_id bigint not null references public.anios_academicos(id) on delete cascade,
  numero smallint not null,
  nombre text not null,
  inicia_en date not null,
  termina_en date not null,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint periodos_academicos_numero_check check (numero between 1 and 4),
  constraint periodos_academicos_nombre_check check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 60),
  constraint periodos_academicos_fechas_check check (termina_en >= inicia_en),
  constraint periodos_academicos_anio_numero_key unique (anio_academico_id, numero)
);

create unique index if not exists periodos_academicos_anio_nombre_uidx
  on public.periodos_academicos (anio_academico_id, lower(btrim(nombre)));

create index if not exists periodos_academicos_anio_fechas_idx
  on public.periodos_academicos (anio_academico_id, inicia_en, termina_en);

alter table public.periodos_academicos enable row level security;

drop policy if exists "autenticados leen periodos academicos" on public.periodos_academicos;
create policy "autenticados leen periodos academicos"
  on public.periodos_academicos for select to authenticated using (true);

revoke all on table public.periodos_academicos from public, anon, authenticated;
grant select on table public.periodos_academicos to authenticated;

revoke all on sequence public.periodos_academicos_id_seq from public, anon, authenticated;

create or replace function public.guardar_periodos_academicos(
  anio_academico_id_solicitado bigint,
  periodos_solicitados jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  anio_registro record;
  cantidad_esperada integer;
  periodo_registro record;
  nombre_limpio text;
  fecha_inicio date;
  fecha_fin date;
  fecha_fin_anterior date;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los periodos académicos.' using errcode = '42501';
  end if;

  select id, inicia_en, termina_en, sistema_periodos, estado
    into anio_registro
  from public.anios_academicos
  where id = anio_academico_id_solicitado;

  if not found then
    raise exception 'El año lectivo seleccionado no existe.' using errcode = '22023';
  end if;

  if anio_registro.estado = 'cerrado' then
    raise exception 'Los periodos de un año cerrado son solo de consulta.' using errcode = '22023';
  end if;

  cantidad_esperada := case anio_registro.sistema_periodos
    when 'bimestres' then 4
    when 'trimestres' then 3
    when 'semestres' then 2
    else 0
  end;

  if periodos_solicitados is null
     or jsonb_typeof(periodos_solicitados) <> 'array'
     or jsonb_array_length(periodos_solicitados) <> cantidad_esperada then
    raise exception 'Debes configurar exactamente % periodos para este año lectivo.', cantidad_esperada using errcode = '22023';
  end if;

  for periodo_registro in
    select elemento, posicion::integer as numero
    from jsonb_array_elements(periodos_solicitados) with ordinality as periodos(elemento, posicion)
    order by posicion
  loop
    nombre_limpio := btrim(periodo_registro.elemento ->> 'nombre');

    if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 60 then
      raise exception 'Cada periodo debe tener un nombre de hasta 60 caracteres.' using errcode = '22023';
    end if;

    if coalesce(periodo_registro.elemento ->> 'inicia_en', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or coalesce(periodo_registro.elemento ->> 'termina_en', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Completa las fechas de todos los periodos.' using errcode = '22023';
    end if;

    fecha_inicio := (periodo_registro.elemento ->> 'inicia_en')::date;
    fecha_fin := (periodo_registro.elemento ->> 'termina_en')::date;

    if fecha_fin < fecha_inicio then
      raise exception 'La fecha final de % no puede ser anterior a su inicio.', nombre_limpio using errcode = '22023';
    end if;

    if fecha_inicio < anio_registro.inicia_en or fecha_fin > anio_registro.termina_en then
      raise exception '% debe estar dentro de las fechas del año lectivo.', nombre_limpio using errcode = '22023';
    end if;

    if fecha_fin_anterior is not null and fecha_inicio <= fecha_fin_anterior then
      raise exception 'Las fechas de los periodos no pueden cruzarse ni superponerse.' using errcode = '22023';
    end if;

    fecha_fin_anterior := fecha_fin;
  end loop;

  if (
    select count(distinct lower(btrim(elemento ->> 'nombre')))
    from jsonb_array_elements(periodos_solicitados) as periodos(elemento)
  ) <> cantidad_esperada then
    raise exception 'Los nombres de los periodos no pueden repetirse.' using errcode = '23505';
  end if;

  delete from public.periodos_academicos
  where anio_academico_id = anio_academico_id_solicitado;

  insert into public.periodos_academicos (
    anio_academico_id, numero, nombre, inicia_en, termina_en,
    creado_por, actualizado_por
  )
  select
    anio_academico_id_solicitado,
    posicion::smallint,
    btrim(elemento ->> 'nombre'),
    (elemento ->> 'inicia_en')::date,
    (elemento ->> 'termina_en')::date,
    auth.uid(),
    auth.uid()
  from jsonb_array_elements(periodos_solicitados) with ordinality as periodos(elemento, posicion)
  order by posicion;
end;
$$;

revoke all on function public.guardar_periodos_academicos(bigint, jsonb) from public, anon;
grant execute on function public.guardar_periodos_academicos(bigint, jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'periodos_academicos'
     ) then
    alter publication supabase_realtime add table public.periodos_academicos;
  end if;
end $$;

commit;
