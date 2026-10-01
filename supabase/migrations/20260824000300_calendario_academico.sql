-- Calendario académico real del ERP. No inserta actividades ni datos de prueba.

begin;

create table public.actividades_calendario (
  id bigint generated always as identity primary key,
  titulo text not null,
  descripcion text,
  tipo text not null,
  estado text not null default 'draft',
  inicia_en timestamptz not null,
  termina_en timestamptz not null,
  todo_el_dia boolean not null default false,
  zona_horaria text not null default 'America/Lima',
  lugar text,
  responsable_nombre text,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  cancelado_en timestamptz,
  constraint actividades_titulo_no_vacio check (btrim(titulo) <> ''),
  constraint actividades_tipo_check check (tipo in ('academico', 'civico', 'comunidad', 'aniversario')),
  constraint actividades_estado_check check (estado in ('draft', 'published', 'cancelled')),
  constraint actividades_fechas_check check (termina_en >= inicia_en),
  constraint actividades_cancelado_check check ((estado = 'cancelled') = (cancelado_en is not null))
);

create table public.destinatarios_actividad (
  id bigint generated always as identity primary key,
  actividad_id bigint not null references public.actividades_calendario(id) on delete cascade,
  tipo_destinatario text not null,
  rol public.rol_portal,
  creado_en timestamptz not null default now(),
  constraint destinatarios_actividad_tipo_check check (tipo_destinatario in ('todos', 'rol')),
  constraint destinatarios_actividad_alcance_check check (
    (tipo_destinatario = 'todos' and rol is null)
    or (tipo_destinatario = 'rol' and rol is not null)
  )
);

create index actividades_calendario_rango_idx
  on public.actividades_calendario (inicia_en, termina_en)
  where estado <> 'cancelled';

create index actividades_calendario_estado_inicio_idx
  on public.actividades_calendario (estado, inicia_en);

create index destinatarios_actividad_actividad_idx
  on public.destinatarios_actividad (actividad_id);

create unique index destinatarios_actividad_todos_uidx
  on public.destinatarios_actividad (actividad_id)
  where tipo_destinatario = 'todos';

create unique index destinatarios_actividad_rol_uidx
  on public.destinatarios_actividad (actividad_id, rol)
  where tipo_destinatario = 'rol';

create trigger actividades_calendario_actualizado
before update on public.actividades_calendario
for each row execute function public.establecer_actualizado_en();

alter table public.actividades_calendario enable row level security;
alter table public.destinatarios_actividad enable row level security;

revoke all on table public.actividades_calendario, public.destinatarios_actividad from anon, authenticated;
grant select, insert, update, delete on table public.actividades_calendario, public.destinatarios_actividad to authenticated;
grant usage, select on sequence public.actividades_calendario_id_seq, public.destinatarios_actividad_id_seq to authenticated;

create policy "gestores leen todas las actividades"
on public.actividades_calendario for select to authenticated
using ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo'));

create policy "comunidad lee actividades publicadas"
on public.actividades_calendario for select to authenticated
using (
  estado = 'published'
  and exists (
    select 1
    from public.destinatarios_actividad destinatario
    where destinatario.actividad_id = actividades_calendario.id
      and (
        destinatario.tipo_destinatario = 'todos'
        or destinatario.rol = (select public.rol_portal_actual())
      )
  )
);

create policy "gestores crean actividades"
on public.actividades_calendario for insert to authenticated
with check (
  (select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo')
  and creado_por = (select auth.uid())
);

create policy "gestores actualizan actividades"
on public.actividades_calendario for update to authenticated
using ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo'))
with check ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo'));

create policy "gestores eliminan actividades"
on public.actividades_calendario for delete to authenticated
using ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo'));

create policy "usuarios leen destinatarios visibles"
on public.destinatarios_actividad for select to authenticated
using (
  (select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo')
  or tipo_destinatario = 'todos'
  or rol = (select public.rol_portal_actual())
);

create policy "gestores crean destinatarios"
on public.destinatarios_actividad for insert to authenticated
with check ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo'));

create policy "gestores actualizan destinatarios"
on public.destinatarios_actividad for update to authenticated
using ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo'))
with check ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo'));

create policy "gestores eliminan destinatarios"
on public.destinatarios_actividad for delete to authenticated
using ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico', 'administrativo'));

create or replace function public.guardar_actividad_calendario(
  actividad_id_solicitada bigint,
  titulo_solicitado text,
  descripcion_solicitada text,
  tipo_solicitado text,
  estado_solicitado text,
  inicia_en_solicitado timestamptz,
  termina_en_solicitado timestamptz,
  todo_el_dia_solicitado boolean,
  lugar_solicitado text,
  responsable_solicitado text,
  roles_destinatarios_solicitados public.rol_portal[]
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  actividad_id_resultado bigint;
begin
  if not ((select public.rol_portal_actual())::text = any (array['direccion', 'coordinador_academico', 'administrativo'])) then
    raise exception 'No tienes permiso para administrar el calendario.' using errcode = '42501';
  end if;

  if actividad_id_solicitada is null then
    insert into public.actividades_calendario (
      titulo, descripcion, tipo, estado, inicia_en, termina_en, todo_el_dia,
      lugar, responsable_nombre, creado_por, actualizado_por,
      cancelado_en
    ) values (
      btrim(titulo_solicitado), nullif(btrim(descripcion_solicitada), ''), tipo_solicitado,
      estado_solicitado, inicia_en_solicitado, termina_en_solicitado,
      coalesce(todo_el_dia_solicitado, false), nullif(btrim(lugar_solicitado), ''),
      nullif(btrim(responsable_solicitado), ''), auth.uid(), auth.uid(),
      case when estado_solicitado = 'cancelled' then now() else null end
    ) returning id into actividad_id_resultado;
  else
    update public.actividades_calendario
    set titulo = btrim(titulo_solicitado),
        descripcion = nullif(btrim(descripcion_solicitada), ''),
        tipo = tipo_solicitado,
        estado = estado_solicitado,
        inicia_en = inicia_en_solicitado,
        termina_en = termina_en_solicitado,
        todo_el_dia = coalesce(todo_el_dia_solicitado, false),
        lugar = nullif(btrim(lugar_solicitado), ''),
        responsable_nombre = nullif(btrim(responsable_solicitado), ''),
        actualizado_por = auth.uid(),
        cancelado_en = case when estado_solicitado = 'cancelled' then coalesce(cancelado_en, now()) else null end
    where id = actividad_id_solicitada
    returning id into actividad_id_resultado;

    if actividad_id_resultado is null then
      raise exception 'La actividad solicitada no existe.';
    end if;

    delete from public.destinatarios_actividad where actividad_id = actividad_id_resultado;
  end if;

  if coalesce(cardinality(roles_destinatarios_solicitados), 0) = 0 then
    insert into public.destinatarios_actividad (actividad_id, tipo_destinatario)
    values (actividad_id_resultado, 'todos');
  else
    insert into public.destinatarios_actividad (actividad_id, tipo_destinatario, rol)
    select actividad_id_resultado, 'rol', rol_destinatario
    from (select distinct unnest(roles_destinatarios_solicitados) as rol_destinatario) roles;
  end if;

  return actividad_id_resultado;
end;
$$;

create or replace function public.cancelar_actividad_calendario(actividad_id_solicitada bigint)
returns void
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if not ((select public.rol_portal_actual())::text = any (array['direccion', 'coordinador_academico', 'administrativo'])) then
    raise exception 'No tienes permiso para cancelar actividades.' using errcode = '42501';
  end if;

  update public.actividades_calendario
  set estado = 'cancelled', cancelado_en = now(), actualizado_por = auth.uid()
  where id = actividad_id_solicitada and estado <> 'cancelled';

  if not found then
    raise exception 'La actividad solicitada no existe o ya fue cancelada.';
  end if;
end;
$$;

revoke all on function public.guardar_actividad_calendario(bigint, text, text, text, text, timestamptz, timestamptz, boolean, text, text, public.rol_portal[]) from public, anon;
grant execute on function public.guardar_actividad_calendario(bigint, text, text, text, text, timestamptz, timestamptz, boolean, text, text, public.rol_portal[]) to authenticated;
revoke all on function public.cancelar_actividad_calendario(bigint) from public, anon;
grant execute on function public.cancelar_actividad_calendario(bigint) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'actividades_calendario'
     ) then
    alter publication supabase_realtime add table public.actividades_calendario;
  end if;
end $$;

commit;
