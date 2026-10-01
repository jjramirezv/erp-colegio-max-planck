-- Gestión real del ciclo de vida de los años lectivos.
-- No inserta años ni información de demostración.

begin;

alter table public.anios_academicos
  add column if not exists estado text not null default 'preparacion',
  add column if not exists creado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists actualizado_en timestamptz not null default now();

update public.anios_academicos
set estado = case when activo then 'activo' else 'preparacion' end
where estado is distinct from case when activo then 'activo' else 'preparacion' end;

alter table public.anios_academicos
  drop constraint if exists anios_academicos_estado_check,
  add constraint anios_academicos_estado_check
    check (estado in ('preparacion', 'activo', 'cerrado')),
  drop constraint if exists anios_academicos_estado_activo_coherente,
  add constraint anios_academicos_estado_activo_coherente
    check ((estado = 'activo' and activo) or (estado <> 'activo' and not activo)),
  drop constraint if exists anios_academicos_fechas_check,
  add constraint anios_academicos_fechas_check
    check (termina_en >= inicia_en),
  drop constraint if exists anios_academicos_nombre_no_vacio,
  add constraint anios_academicos_nombre_no_vacio
    check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 40);

create unique index if not exists anios_academicos_unico_activo_uidx
  on public.anios_academicos ((activo))
  where activo;

create index if not exists anios_academicos_estado_inicio_idx
  on public.anios_academicos (estado, inicia_en desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'anios_academicos_actualizado'
      and tgrelid = 'public.anios_academicos'::regclass
  ) then
    create trigger anios_academicos_actualizado
    before update on public.anios_academicos
    for each row execute function public.establecer_actualizado_en();
  end if;
end $$;

create or replace function public.guardar_anio_lectivo(
  anio_id_solicitado bigint,
  nombre_solicitado text,
  inicia_en_solicitado date,
  termina_en_solicitado date,
  sistema_periodos_solicitado text
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  anio_id_resultado bigint;
  nombre_limpio text := btrim(nombre_solicitado);
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los años lectivos.' using errcode = '42501';
  end if;

  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 40 then
    raise exception 'El nombre debe contener entre 1 y 40 caracteres.' using errcode = '22023';
  end if;
  if inicia_en_solicitado is null or termina_en_solicitado is null or termina_en_solicitado < inicia_en_solicitado then
    raise exception 'La fecha de cierre debe ser igual o posterior a la fecha de inicio.' using errcode = '22023';
  end if;
  if sistema_periodos_solicitado is null or sistema_periodos_solicitado not in ('bimestres', 'trimestres', 'semestres') then
    raise exception 'La organización académica no es válida.' using errcode = '22023';
  end if;

  if anio_id_solicitado is null then
    insert into public.anios_academicos (
      nombre, inicia_en, termina_en, sistema_periodos, activo, estado,
      creado_por, actualizado_por
    ) values (
      nombre_limpio, inicia_en_solicitado, termina_en_solicitado,
      sistema_periodos_solicitado, false, 'preparacion', auth.uid(), auth.uid()
    ) returning id into anio_id_resultado;
  else
    update public.anios_academicos
    set nombre = nombre_limpio,
        inicia_en = inicia_en_solicitado,
        termina_en = termina_en_solicitado,
        sistema_periodos = sistema_periodos_solicitado,
        actualizado_por = auth.uid()
    where id = anio_id_solicitado and estado = 'preparacion'
    returning id into anio_id_resultado;

    if anio_id_resultado is null then
      raise exception 'Solo se puede editar un año que está en preparación.' using errcode = '22023';
    end if;
  end if;

  return anio_id_resultado;
end;
$$;

create or replace function public.activar_anio_lectivo(anio_id_solicitado bigint)
returns void
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede activar un año lectivo.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(730021);

  if exists (select 1 from public.anios_academicos where activo and id <> anio_id_solicitado) then
    raise exception 'Ya existe un año lectivo activo. Ciérralo antes de activar otro.' using errcode = '23505';
  end if;

  update public.anios_academicos
  set estado = 'activo', activo = true, actualizado_por = auth.uid()
  where id = anio_id_solicitado and estado = 'preparacion';

  if not found then
    raise exception 'El año no existe o ya no está en preparación.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.cerrar_anio_lectivo(anio_id_solicitado bigint)
returns void
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede cerrar un año lectivo.' using errcode = '42501';
  end if;

  update public.anios_academicos
  set estado = 'cerrado', activo = false, actualizado_por = auth.uid()
  where id = anio_id_solicitado and estado = 'activo';

  if not found then
    raise exception 'El año no existe o no está activo.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.eliminar_anio_en_preparacion(anio_id_solicitado bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar un año lectivo.' using errcode = '42501';
  end if;

  delete from public.anios_academicos
  where id = anio_id_solicitado and estado = 'preparacion';

  if not found then
    raise exception 'Solo se puede eliminar un año que está en preparación.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.guardar_anio_lectivo(bigint, text, date, date, text) from public, anon;
revoke all on function public.activar_anio_lectivo(bigint) from public, anon;
revoke all on function public.cerrar_anio_lectivo(bigint) from public, anon;
revoke all on function public.eliminar_anio_en_preparacion(bigint) from public, anon;

grant execute on function public.guardar_anio_lectivo(bigint, text, date, date, text) to authenticated;
grant execute on function public.activar_anio_lectivo(bigint) to authenticated;
grant execute on function public.cerrar_anio_lectivo(bigint) to authenticated;
grant execute on function public.eliminar_anio_en_preparacion(bigint) to authenticated;

commit;
