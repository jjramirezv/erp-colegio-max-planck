-- Datos generales e identidad institucional.
-- Amplía la configuración existente sin insertar información de ejemplo.

begin;

alter table public.configuracion_institucional
  add column if not exists tipo_gestion text,
  add column if not exists modalidad_educativa text,
  add column if not exists ugel text,
  add column if not exists codigo_local text,
  add column if not exists resolucion_creacion text,
  add column if not exists lema_institucional text,
  add column if not exists departamento text,
  add column if not exists provincia text,
  add column if not exists distrito text,
  add column if not exists sitio_web text,
  add column if not exists logo_path text,
  add column if not exists color_primario text not null default '#064E3B',
  add column if not exists color_secundario text not null default '#F3BD24',
  add column if not exists color_acento text not null default '#237DB3',
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null;

alter table public.configuracion_institucional
  drop constraint if exists configuracion_tipo_gestion_check,
  add constraint configuracion_tipo_gestion_check
    check (tipo_gestion is null or tipo_gestion in ('privada', 'publica', 'convenio')),
  drop constraint if exists configuracion_color_primario_check,
  add constraint configuracion_color_primario_check
    check (color_primario ~ '^#[0-9A-Fa-f]{6}$'),
  drop constraint if exists configuracion_color_secundario_check,
  add constraint configuracion_color_secundario_check
    check (color_secundario ~ '^#[0-9A-Fa-f]{6}$'),
  drop constraint if exists configuracion_color_acento_check,
  add constraint configuracion_color_acento_check
    check (color_acento ~ '^#[0-9A-Fa-f]{6}$');

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'configuracion_institucional_actualizada'
      and tgrelid = 'public.configuracion_institucional'::regclass
  ) then
    create trigger configuracion_institucional_actualizada
    before update on public.configuracion_institucional
    for each row execute function public.establecer_actualizado_en();
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'institutional-assets',
  'institutional-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "autenticados leen recursos institucionales"
on storage.objects for select to authenticated
using (bucket_id = 'institutional-assets');

create policy "direccion carga recursos institucionales"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'institutional-assets'
  and (select public.rol_portal_actual())::text = 'direccion'
);

create policy "direccion actualiza recursos institucionales"
on storage.objects for update to authenticated
using (
  bucket_id = 'institutional-assets'
  and (select public.rol_portal_actual())::text = 'direccion'
)
with check (
  bucket_id = 'institutional-assets'
  and (select public.rol_portal_actual())::text = 'direccion'
);

create policy "direccion elimina recursos institucionales"
on storage.objects for delete to authenticated
using (
  bucket_id = 'institutional-assets'
  and (select public.rol_portal_actual())::text = 'direccion'
);

commit;
