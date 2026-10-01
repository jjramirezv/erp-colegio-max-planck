-- Comunicados: Dirección y Coordinación escriben a toda la comunidad o a un salón y pueden mostrar
-- un aviso al ingresar entre dos fechas; los docentes escriben a estudiantes y familias de sus salones.
-- Las escrituras pasan por funciones; la lectura respeta rol, salón y vínculo familiar.
begin;

alter table public.comunicados_institucionales
  add column seccion_id bigint references public.secciones(id) on delete set null,
  add column firma text,
  add column destacado boolean not null default false,
  add column destacado_desde date,
  add column destacado_hasta date,
  add column actualizado_en timestamptz not null default now(),
  add column archivado_en timestamptz,
  add constraint comunicados_destacado_fechas check (not destacado or (destacado_desde is not null and destacado_hasta is not null and destacado_hasta >= destacado_desde));

create table public.comunicados_vistos (
  comunicado_id bigint not null references public.comunicados_institucionales(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  visto_en timestamptz not null default now(),
  primary key (comunicado_id, usuario_id)
);
alter table public.comunicados_vistos enable row level security;
revoke all on table public.comunicados_vistos from public, anon, authenticated;

create or replace function public.docente_de_seccion(seccion bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.asignaciones_docentes ad
    join public.cursos_seccion cs on cs.id = ad.curso_seccion_id
    where ad.docente_id = auth.uid() and ad.activo and ad.archivado_en is null
      and cs.seccion_id = seccion and cs.activo and cs.archivado_en is null);
$$;
revoke all on function public.docente_de_seccion(bigint) from public, anon;
grant execute on function public.docente_de_seccion(bigint) to authenticated;

-- ¿El usuario actual es destinatario? Rol incluido y, si hay salón, pertenece a él.
create or replace function public.comunicado_visible(destinos public.rol_portal[], seccion bigint)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare rol public.rol_portal := public.rol_portal_actual();
begin
  if rol is null or not (rol = any(destinos)) then return false; end if;
  if seccion is null then return true; end if;
  return case rol::text
    when 'estudiante' then exists (select 1 from public.matriculas_estudiantes m where m.estudiante_id = auth.uid() and m.seccion_id = seccion and m.estado = 'active' and m.archivado_en is null)
    when 'familia' then exists (select 1 from public.apoderados_estudiantes v join public.matriculas_estudiantes m on m.estudiante_id = v.estudiante_id where v.apoderado_id = auth.uid() and m.seccion_id = seccion and m.estado = 'active' and m.archivado_en is null)
    when 'docente' then public.docente_de_seccion(seccion)
    else true end;
end;
$$;
revoke all on function public.comunicado_visible(public.rol_portal[], bigint) from public, anon;
grant execute on function public.comunicado_visible(public.rol_portal[], bigint) to authenticated;

drop policy if exists "direccion administra comunicados" on public.comunicados_institucionales;
drop policy if exists "destinatarios leen comunicados publicados" on public.comunicados_institucionales;
create policy "destinatarios leen comunicados publicados" on public.comunicados_institucionales for select to authenticated
  using (publicado and publicado_en <= now() and archivado_en is null and public.comunicado_visible(destinatarios, seccion_id));
revoke insert, update, delete on public.comunicados_institucionales from authenticated;

create or replace function public.guardar_comunicado(
  comunicado bigint, titulo text, contenido text, destinos text[], seccion bigint,
  destacado boolean, desde date, hasta date, publicar boolean)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  rol_actual text := public.rol_portal_actual()::text;
  gestor boolean := rol_actual in ('direccion', 'coordinador_academico');
  actual public.comunicados_institucionales%rowtype;
  firma_texto text; resultado bigint;
begin
  if not gestor and rol_actual is distinct from 'docente' then
    raise exception 'Solo Dirección, Coordinación y docentes pueden publicar comunicados.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(titulo, ''))) not between 1 and 160 then raise exception 'El título debe tener entre 1 y 160 caracteres.' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(contenido, ''))) not between 1 and 10000 then raise exception 'Escribe el mensaje del comunicado.' using errcode = '22023'; end if;
  if coalesce(array_length(destinos, 1), 0) = 0 or not destinos <@ array['estudiante', 'familia', 'docente', 'administrativo', 'coordinador_academico', 'direccion'] then
    raise exception 'Elige para quién es el comunicado.' using errcode = '22023';
  end if;
  if not gestor then
    if seccion is null or not public.docente_de_seccion(seccion) then raise exception 'Elige uno de tus salones.' using errcode = '42501'; end if;
    if not destinos <@ array['estudiante', 'familia'] then raise exception 'Los docentes escriben a estudiantes y familias de sus salones.' using errcode = '42501'; end if;
    if destacado then raise exception 'Solo Dirección o Coordinación pueden mostrar avisos al ingresar.' using errcode = '42501'; end if;
  end if;
  if destacado and (desde is null or hasta is null or hasta < desde or hasta - desde > 60) then
    raise exception 'Indica desde y hasta cuándo se muestra el aviso (máximo 60 días).' using errcode = '22023';
  end if;
  if seccion is not null and not exists (select 1 from public.secciones where id = seccion) then raise exception 'El salón no existe.' using errcode = '22023'; end if;

  if comunicado is not null then
    select * into actual from public.comunicados_institucionales where id = comunicado for update;
    if not found or actual.archivado_en is not null then raise exception 'El comunicado no existe o fue archivado.' using errcode = '22023'; end if;
    if not gestor and actual.creado_por is distinct from auth.uid() then raise exception 'Solo puedes editar tus comunicados.' using errcode = '42501'; end if;
  end if;

  select case when rol_actual = 'direccion' then 'Dirección' when rol_actual = 'coordinador_academico' then 'Coordinación Académica'
    else p.nombre_completo || coalesce(' · ' || (select concat(n.nombre, ' · ', g.nombre, ' ', s.nombre) from public.secciones s join public.grados g on g.id = s.grado_id join public.niveles_educativos n on n.id = g.nivel_id where s.id = seccion), '') end
  into firma_texto from public.perfiles p where p.id = auth.uid();

  if comunicado is null then
    insert into public.comunicados_institucionales (titulo, contenido, destinatarios, seccion_id, firma, destacado, destacado_desde, destacado_hasta, publicado, publicado_en, creado_por)
    values (btrim(titulo), btrim(contenido), destinos::public.rol_portal[], seccion, firma_texto, coalesce(destacado, false),
      case when destacado then desde end, case when destacado then hasta end, coalesce(publicar, false), now(), auth.uid())
    returning id into resultado;
  else
    update public.comunicados_institucionales set
      titulo = btrim(guardar_comunicado.titulo), contenido = btrim(guardar_comunicado.contenido),
      destinatarios = destinos::public.rol_portal[], seccion_id = seccion,
      destacado = coalesce(guardar_comunicado.destacado, false),
      destacado_desde = case when guardar_comunicado.destacado then desde end,
      destacado_hasta = case when guardar_comunicado.destacado then hasta end,
      publicado = actual.publicado or coalesce(publicar, false),
      publicado_en = case when not actual.publicado and coalesce(publicar, false) then now() else actual.publicado_en end,
      actualizado_en = now()
    where id = comunicado returning id into resultado;
  end if;
  return resultado;
end;
$$;
revoke all on function public.guardar_comunicado(bigint, text, text, text[], bigint, boolean, date, date, boolean) from public, anon;
grant execute on function public.guardar_comunicado(bigint, text, text, text[], bigint, boolean, date, date, boolean) to authenticated;

create or replace function public.archivar_comunicado(comunicado bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.comunicados_institucionales set archivado_en = now(), actualizado_en = now()
  where id = comunicado and archivado_en is null
    and (creado_por = auth.uid() or public.rol_portal_actual()::text in ('direccion', 'coordinador_academico'));
  if not found then raise exception 'No puedes archivar este comunicado.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.archivar_comunicado(bigint) from public, anon;
grant execute on function public.archivar_comunicado(bigint) to authenticated;

create or replace function public.marcar_comunicado_visto(comunicado bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.comunicados_institucionales c where c.id = comunicado and c.publicado and c.archivado_en is null
    and public.comunicado_visible(c.destinatarios, c.seccion_id)) then
    insert into public.comunicados_vistos (comunicado_id, usuario_id) values (comunicado, auth.uid()) on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.marcar_comunicado_visto(bigint) from public, anon;
grant execute on function public.marcar_comunicado_visto(bigint) to authenticated;

-- Bandeja (recibidos) y, para quien escribe, sus enviados (Dirección y Coordinación ven todos).
create or replace function public.listar_comunicados()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  rol_actual text := public.rol_portal_actual()::text;
  hoy date := (now() at time zone 'America/Lima')::date;
begin
  if rol_actual is null then raise exception 'Inicia sesión para ver los comunicados.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'inbox', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.titulo, 'body', c.contenido, 'signature', coalesce(c.firma, 'Colegio'),
        'publishedAt', c.publicado_en, 'audience', c.destinatarios, 'section', seccion_label.nombre,
        'featured', c.destacado and hoy between c.destacado_desde and c.destacado_hasta,
        'seen', exists (select 1 from public.comunicados_vistos v where v.comunicado_id = c.id and v.usuario_id = auth.uid()))
        order by c.publicado_en desc)
      from public.comunicados_institucionales c
      left join lateral (select concat(n.nombre, ' · ', g.nombre, ' ', s.nombre) as nombre from public.secciones s join public.grados g on g.id = s.grado_id join public.niveles_educativos n on n.id = g.nivel_id where s.id = c.seccion_id) seccion_label on true
      where c.publicado and c.publicado_en <= now() and c.archivado_en is null
        and c.creado_por is distinct from auth.uid() and public.comunicado_visible(c.destinatarios, c.seccion_id)), '[]'::jsonb),
    'sent', case when rol_actual in ('direccion', 'coordinador_academico', 'docente') then coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.titulo, 'body', c.contenido, 'signature', coalesce(c.firma, 'Colegio'),
        'publishedAt', c.publicado_en, 'updatedAt', c.actualizado_en, 'audience', c.destinatarios,
        'sectionId', c.seccion_id, 'section', seccion_label.nombre, 'published', c.publicado,
        'featured', c.destacado, 'featuredFrom', c.destacado_desde, 'featuredTo', c.destacado_hasta,
        'mine', c.creado_por = auth.uid(),
        'seenCount', (select count(*) from public.comunicados_vistos v where v.comunicado_id = c.id))
        order by c.actualizado_en desc)
      from public.comunicados_institucionales c
      left join lateral (select concat(n.nombre, ' · ', g.nombre, ' ', s.nombre) as nombre from public.secciones s join public.grados g on g.id = s.grado_id join public.niveles_educativos n on n.id = g.nivel_id where s.id = c.seccion_id) seccion_label on true
      where c.archivado_en is null and (c.creado_por = auth.uid() or rol_actual in ('direccion', 'coordinador_academico'))), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;
revoke all on function public.listar_comunicados() from public, anon;
grant execute on function public.listar_comunicados() to authenticated;

commit;
