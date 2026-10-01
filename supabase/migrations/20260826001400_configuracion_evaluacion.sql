-- Escalas y sistemas de evaluación por año lectivo y nivel educativo.
-- No inserta configuraciones ni registros de demostración.

begin;

create table if not exists public.configuraciones_evaluacion (
  id bigint generated always as identity primary key,
  anio_academico_id bigint not null references public.anios_academicos(id) on delete cascade,
  nivel_educativo_id bigint not null references public.niveles_educativos(id) on delete restrict,
  tipo_escala text not null,
  calculo_final text not null,
  valor_minimo numeric(8,2),
  valor_maximo numeric(8,2),
  valor_aprobatorio numeric(8,2),
  decimales smallint,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint configuraciones_evaluacion_tipo_check check (tipo_escala in ('cualitativa', 'numerica')),
  constraint configuraciones_evaluacion_calculo_check check (calculo_final in ('ultimo_logro', 'promedio_periodos')),
  constraint configuraciones_evaluacion_decimales_check check (decimales is null or decimales between 0 and 2),
  constraint configuraciones_evaluacion_anio_nivel_key unique (anio_academico_id, nivel_educativo_id)
);

create table if not exists public.niveles_logro_evaluacion (
  id bigint generated always as identity primary key,
  configuracion_evaluacion_id bigint not null references public.configuraciones_evaluacion(id) on delete cascade,
  orden smallint not null,
  codigo text not null,
  nombre text not null,
  satisfactorio boolean not null default false,
  constraint niveles_logro_orden_check check (orden between 1 and 8),
  constraint niveles_logro_codigo_check check (btrim(codigo) <> '' and char_length(btrim(codigo)) <= 10),
  constraint niveles_logro_nombre_check check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 60),
  constraint niveles_logro_configuracion_orden_key unique (configuracion_evaluacion_id, orden)
);

create unique index if not exists niveles_logro_configuracion_codigo_uidx
  on public.niveles_logro_evaluacion (configuracion_evaluacion_id, lower(btrim(codigo)));

create index if not exists configuraciones_evaluacion_anio_idx
  on public.configuraciones_evaluacion (anio_academico_id, nivel_educativo_id);

alter table public.configuraciones_evaluacion enable row level security;
alter table public.niveles_logro_evaluacion enable row level security;

drop policy if exists "autenticados leen configuraciones evaluacion" on public.configuraciones_evaluacion;
create policy "autenticados leen configuraciones evaluacion"
  on public.configuraciones_evaluacion for select to authenticated using (true);

drop policy if exists "autenticados leen niveles logro evaluacion" on public.niveles_logro_evaluacion;
create policy "autenticados leen niveles logro evaluacion"
  on public.niveles_logro_evaluacion for select to authenticated using (true);

revoke all on table public.configuraciones_evaluacion, public.niveles_logro_evaluacion from public, anon, authenticated;
grant select on table public.configuraciones_evaluacion, public.niveles_logro_evaluacion to authenticated;
revoke all on sequence public.configuraciones_evaluacion_id_seq, public.niveles_logro_evaluacion_id_seq from public, anon, authenticated;

create or replace function public.guardar_configuracion_evaluacion(
  anio_academico_id_solicitado bigint,
  nivel_educativo_id_solicitado bigint,
  tipo_escala_solicitado text,
  calculo_final_solicitado text,
  valor_minimo_solicitado numeric,
  valor_maximo_solicitado numeric,
  valor_aprobatorio_solicitado numeric,
  decimales_solicitados smallint,
  niveles_logro_solicitados jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  configuracion_id_resultado bigint;
  nivel_registro record;
  codigo_limpio text;
  nombre_limpio text;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede configurar el sistema de evaluación.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.anios_academicos
    where id = anio_academico_id_solicitado and estado <> 'cerrado'
  ) then
    raise exception 'Selecciona un año lectivo disponible para edición.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.niveles_educativos
    where id = nivel_educativo_id_solicitado and activo
  ) then
    raise exception 'Selecciona un nivel educativo activo.' using errcode = '22023';
  end if;

  if tipo_escala_solicitado not in ('cualitativa', 'numerica') then
    raise exception 'Selecciona un tipo de escala válido.' using errcode = '22023';
  end if;

  if calculo_final_solicitado not in ('ultimo_logro', 'promedio_periodos') then
    raise exception 'Selecciona una regla de cálculo final válida.' using errcode = '22023';
  end if;

  if tipo_escala_solicitado = 'numerica' then
    if valor_minimo_solicitado is null or valor_maximo_solicitado is null
       or valor_aprobatorio_solicitado is null or decimales_solicitados is null then
      raise exception 'Completa todos los valores de la escala numérica.' using errcode = '22023';
    end if;
    if valor_maximo_solicitado <= valor_minimo_solicitado then
      raise exception 'El valor máximo debe ser mayor que el mínimo.' using errcode = '22023';
    end if;
    if valor_aprobatorio_solicitado < valor_minimo_solicitado
       or valor_aprobatorio_solicitado > valor_maximo_solicitado then
      raise exception 'El valor aprobatorio debe estar dentro de la escala.' using errcode = '22023';
    end if;
    if decimales_solicitados not between 0 and 2 then
      raise exception 'Los decimales permitidos deben estar entre 0 y 2.' using errcode = '22023';
    end if;
  else
    if niveles_logro_solicitados is null
       or jsonb_typeof(niveles_logro_solicitados) <> 'array'
       or jsonb_array_length(niveles_logro_solicitados) not between 2 and 8 then
      raise exception 'Configura entre 2 y 8 niveles de logro.' using errcode = '22023';
    end if;

    for nivel_registro in
      select elemento, posicion::integer as orden
      from jsonb_array_elements(niveles_logro_solicitados) with ordinality as niveles(elemento, posicion)
      order by posicion
    loop
      codigo_limpio := upper(btrim(nivel_registro.elemento ->> 'codigo'));
      nombre_limpio := btrim(nivel_registro.elemento ->> 'nombre');
      if codigo_limpio is null or codigo_limpio = '' or char_length(codigo_limpio) > 10 then
        raise exception 'Cada nivel de logro debe tener un código de hasta 10 caracteres.' using errcode = '22023';
      end if;
      if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 60 then
        raise exception 'Cada nivel de logro debe tener un nombre de hasta 60 caracteres.' using errcode = '22023';
      end if;
    end loop;

    if (
      select count(distinct lower(btrim(elemento ->> 'codigo')))
      from jsonb_array_elements(niveles_logro_solicitados) as niveles(elemento)
    ) <> jsonb_array_length(niveles_logro_solicitados) then
      raise exception 'Los códigos de logro no pueden repetirse.' using errcode = '23505';
    end if;
  end if;

  insert into public.configuraciones_evaluacion (
    anio_academico_id, nivel_educativo_id, tipo_escala, calculo_final,
    valor_minimo, valor_maximo, valor_aprobatorio, decimales,
    creado_por, actualizado_por
  ) values (
    anio_academico_id_solicitado, nivel_educativo_id_solicitado,
    tipo_escala_solicitado, calculo_final_solicitado,
    case when tipo_escala_solicitado = 'numerica' then valor_minimo_solicitado end,
    case when tipo_escala_solicitado = 'numerica' then valor_maximo_solicitado end,
    case when tipo_escala_solicitado = 'numerica' then valor_aprobatorio_solicitado end,
    case when tipo_escala_solicitado = 'numerica' then decimales_solicitados end,
    auth.uid(), auth.uid()
  )
  on conflict (anio_academico_id, nivel_educativo_id) do update
  set tipo_escala = excluded.tipo_escala,
      calculo_final = excluded.calculo_final,
      valor_minimo = excluded.valor_minimo,
      valor_maximo = excluded.valor_maximo,
      valor_aprobatorio = excluded.valor_aprobatorio,
      decimales = excluded.decimales,
      actualizado_por = auth.uid(),
      actualizado_en = now()
  returning id into configuracion_id_resultado;

  delete from public.niveles_logro_evaluacion
  where configuracion_evaluacion_id = configuracion_id_resultado;

  if tipo_escala_solicitado = 'cualitativa' then
    insert into public.niveles_logro_evaluacion (
      configuracion_evaluacion_id, orden, codigo, nombre, satisfactorio
    )
    select
      configuracion_id_resultado,
      posicion::smallint,
      upper(btrim(elemento ->> 'codigo')),
      btrim(elemento ->> 'nombre'),
      coalesce((elemento ->> 'satisfactorio')::boolean, false)
    from jsonb_array_elements(niveles_logro_solicitados) with ordinality as niveles(elemento, posicion)
    order by posicion;
  end if;

  return configuracion_id_resultado;
end;
$$;

revoke all on function public.guardar_configuracion_evaluacion(bigint, bigint, text, text, numeric, numeric, numeric, smallint, jsonb) from public, anon;
grant execute on function public.guardar_configuracion_evaluacion(bigint, bigint, text, text, numeric, numeric, numeric, smallint, jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'configuraciones_evaluacion') then
      alter publication supabase_realtime add table public.configuraciones_evaluacion;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'niveles_logro_evaluacion') then
      alter publication supabase_realtime add table public.niveles_logro_evaluacion;
    end if;
  end if;
end $$;

commit;
