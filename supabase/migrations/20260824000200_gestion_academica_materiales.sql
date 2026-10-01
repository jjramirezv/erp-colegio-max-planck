-- 02 · Gestión académica y materiales del Colegio Max Planck.
-- Requiere 20260824000100_esquema_base_erp.sql.
-- Los archivos se guardan en Storage; PostgreSQL conserva metadatos, versiones,
-- publicaciones, destinatarios, distribucion fisica y auditoria.

-- -----------------------------------------------------------------------------
-- Rol y configuracion del alcance por nivel educativo
-- -----------------------------------------------------------------------------

-- El rol coordinador_academico ya se declara en el esquema base. Mantenerlo
-- allí evita el uso inseguro de un valor enum nuevo dentro de esta migración.

alter table public.niveles_educativos
  add column if not exists alcance_material text not null default 'course';

-- Inicial distribuye materiales por seccion. Los demas niveles (incluidos
-- primaria y secundaria) usan una oferta de curso concreta.
update public.niveles_educativos
set alcance_material = 'section'
where lower(nombre) like '%inicial%';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'niveles_educativos_alcance_material_check'
      and conrelid = 'public.niveles_educativos'::regclass
  ) then
    alter table public.niveles_educativos
      add constraint niveles_educativos_alcance_material_check
      check (alcance_material in ('section', 'course'));
  end if;
end;
$$;

-- Permite claves foraneas compuestas que garantizan que el anio indicado
-- corresponda realmente a la seccion.
create unique index if not exists secciones_id_anio_academico_uidx
  on public.secciones (id, anio_academico_id);

-- -----------------------------------------------------------------------------
-- Catalogo academico, asignaciones y matriculas
-- -----------------------------------------------------------------------------

create table public.asignaturas (
  id bigint generated always as identity primary key,
  codigo text not null,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint asignaturas_codigo_no_vacio check (btrim(codigo) <> ''),
  constraint asignaturas_nombre_no_vacio check (btrim(nombre) <> '')
);

create unique index asignaturas_codigo_activo_uidx
  on public.asignaturas (lower(codigo))
  where archivado_en is null;

create index asignaturas_nombre_activo_idx
  on public.asignaturas (activo, lower(nombre))
  where archivado_en is null;

create index asignaturas_creado_por_idx on public.asignaturas (creado_por);
create index asignaturas_actualizado_por_idx on public.asignaturas (actualizado_por);
create index asignaturas_archivado_por_idx on public.asignaturas (archivado_por);

create table public.cursos_seccion (
  id bigint generated always as identity primary key,
  anio_academico_id bigint not null,
  seccion_id bigint not null,
  asignatura_id bigint not null references public.asignaturas(id) on delete restrict,
  nombre_visible text,
  horas_semanales smallint,
  activo boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint cursos_seccion_anio_fkey
    foreign key (seccion_id, anio_academico_id)
    references public.secciones (id, anio_academico_id)
    on delete restrict,
  constraint cursos_nombre_visible_no_vacio
    check (nombre_visible is null or btrim(nombre_visible) <> ''),
  constraint cursos_horas_semanales_positivas
    check (horas_semanales is null or horas_semanales > 0),
  unique (id, seccion_id),
  unique (id, asignatura_id)
);

create unique index cursos_seccion_asignatura_activo_uidx
  on public.cursos_seccion (seccion_id, asignatura_id)
  where archivado_en is null;

create index cursos_anio_seccion_idx
  on public.cursos_seccion (anio_academico_id, seccion_id)
  where archivado_en is null and activo;

create index cursos_asignatura_id_idx
  on public.cursos_seccion (asignatura_id);

create index cursos_seccion_anio_fk_idx
  on public.cursos_seccion (seccion_id, anio_academico_id);

create index cursos_creado_por_idx on public.cursos_seccion (creado_por);
create index cursos_actualizado_por_idx on public.cursos_seccion (actualizado_por);
create index cursos_archivado_por_idx on public.cursos_seccion (archivado_por);

create table public.asignaciones_docentes (
  id bigint generated always as identity primary key,
  curso_seccion_id bigint references public.cursos_seccion(id) on delete restrict,
  seccion_id bigint references public.secciones(id) on delete restrict,
  docente_id uuid references public.perfiles(id) on delete set null,
  rol_asignacion text not null default 'titular',
  inicia_en date,
  termina_en date,
  activo boolean not null default true,
  asignado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint asignaciones_docentes_rol_check
    check (rol_asignacion in ('titular', 'apoyo', 'reemplazo')),
  constraint asignaciones_docentes_alcance_check
    check ((curso_seccion_id is null) <> (seccion_id is null)),
  constraint asignaciones_docentes_fechas_check
    check (termina_en is null or inicia_en is null or termina_en >= inicia_en)
);

create unique index asignaciones_docentes_curso_docente_activo_uidx
  on public.asignaciones_docentes (curso_seccion_id, docente_id)
  where archivado_en is null and activo
    and curso_seccion_id is not null and docente_id is not null;

create unique index asignaciones_docentes_seccion_docente_activo_uidx
  on public.asignaciones_docentes (seccion_id, docente_id)
  where archivado_en is null and activo
    and seccion_id is not null and docente_id is not null;

create unique index asignaciones_docentes_curso_unico_activo_uidx
  on public.asignaciones_docentes (curso_seccion_id)
  where archivado_en is null and activo and curso_seccion_id is not null;

create unique index asignaciones_docentes_seccion_unica_activa_uidx
  on public.asignaciones_docentes (seccion_id)
  where archivado_en is null and activo and seccion_id is not null;

create index asignaciones_docentes_docente_curso_idx
  on public.asignaciones_docentes (docente_id, curso_seccion_id)
  where archivado_en is null and activo;

create index asignaciones_docentes_curso_id_idx
  on public.asignaciones_docentes (curso_seccion_id);

create index asignaciones_docentes_seccion_id_idx
  on public.asignaciones_docentes (seccion_id);

create index asignaciones_docentes_docente_id_fk_idx
  on public.asignaciones_docentes (docente_id);

create index asignaciones_docentes_asignado_por_idx on public.asignaciones_docentes (asignado_por);
create index asignaciones_docentes_archivado_por_idx on public.asignaciones_docentes (archivado_por);

create table public.matriculas_estudiantes (
  id bigint generated always as identity primary key,
  anio_academico_id bigint not null,
  seccion_id bigint not null,
  estudiante_id uuid references public.perfiles(id) on delete set null,
  estado text not null default 'active',
  matriculado_en date not null default ((now() at time zone 'America/Lima')::date),
  retirado_en date,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint matriculas_seccion_anio_fkey
    foreign key (seccion_id, anio_academico_id)
    references public.secciones (id, anio_academico_id)
    on delete restrict,
  constraint matriculas_estado_check
    check (estado in ('active', 'transferred', 'withdrawn', 'completed')),
  constraint matriculas_fechas_check
    check (retirado_en is null or retirado_en >= matriculado_en),
  unique (id, seccion_id)
);

create unique index matriculas_estudiante_anio_activo_uidx
  on public.matriculas_estudiantes (estudiante_id, anio_academico_id)
  where archivado_en is null and estado = 'active' and estudiante_id is not null;

create index matriculas_seccion_estado_idx
  on public.matriculas_estudiantes (seccion_id, estado)
  where archivado_en is null;

create index matriculas_estudiante_seccion_idx
  on public.matriculas_estudiantes (estudiante_id, seccion_id)
  where archivado_en is null;

create index matriculas_seccion_anio_fk_idx
  on public.matriculas_estudiantes (seccion_id, anio_academico_id);

create index matriculas_estudiante_id_fk_idx on public.matriculas_estudiantes (estudiante_id);
create index matriculas_creado_por_idx on public.matriculas_estudiantes (creado_por);
create index matriculas_actualizado_por_idx on public.matriculas_estudiantes (actualizado_por);
create index matriculas_archivado_por_idx on public.matriculas_estudiantes (archivado_por);

-- -----------------------------------------------------------------------------
-- Materiales, archivos versionados, publicaciones y destinatarios
-- -----------------------------------------------------------------------------

create table public.materiales_educativos (
  id bigint generated always as identity primary key,
  titulo text not null,
  descripcion text,
  tipo_material text not null default 'digital',
  origen text not null default 'official',
  asignatura_id bigint references public.asignaturas(id) on delete restrict,
  curso_seccion_id bigint references public.cursos_seccion(id) on delete restrict,
  seccion_id bigint references public.secciones(id) on delete restrict,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint materiales_titulo_no_vacio check (btrim(titulo) <> ''),
  constraint materiales_tipo_check
    check (tipo_material in ('digital', 'physical', 'mixed')),
  constraint materiales_origen_check
    check (origen in ('official', 'teacher_extra')),
  constraint materiales_alcance_check
    check (
      curso_seccion_id is null
      or seccion_id is null
    )
);

create index materiales_asignatura_idx
  on public.materiales_educativos (asignatura_id)
  where archivado_en is null;

create index materiales_curso_idx
  on public.materiales_educativos (curso_seccion_id)
  where archivado_en is null;

create index materiales_seccion_idx
  on public.materiales_educativos (seccion_id)
  where archivado_en is null;

create index materiales_creado_por_idx
  on public.materiales_educativos (creado_por, creado_en desc)
  where archivado_en is null;

create index materiales_asignatura_id_fk_idx on public.materiales_educativos (asignatura_id);
create index materiales_curso_id_fk_idx
  on public.materiales_educativos (curso_seccion_id);
create index materiales_seccion_id_fk_idx
  on public.materiales_educativos (seccion_id);
create index materiales_creado_por_fk_idx on public.materiales_educativos (creado_por);
create index materiales_actualizado_por_idx on public.materiales_educativos (actualizado_por);
create index materiales_archivado_por_idx on public.materiales_educativos (archivado_por);

create table public.versiones_material (
  id bigint generated always as identity primary key,
  material_id bigint not null references public.materiales_educativos(id) on delete restrict,
  numero_version integer not null,
  etiqueta_version text not null,
  ruta_almacenamiento text not null,
  nombre_archivo_original text not null,
  tipo_mime text not null,
  tamano_bytes bigint not null,
  huella_sha256 text,
  notas_cambio text,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint versiones_numero_positivo check (numero_version > 0),
  constraint versiones_etiqueta_check
    check (etiqueta_version ~ '^[0-9]+([.][0-9]+){0,2}$'),
  constraint versiones_ruta_no_vacia check (btrim(ruta_almacenamiento) <> ''),
  constraint versiones_ruta_segura
    check (ruta_almacenamiento !~ '(^/|(^|/)\.\.(/|$))'),
  constraint versiones_archivo_no_vacio check (btrim(nombre_archivo_original) <> ''),
  constraint versiones_mime_no_vacio check (btrim(tipo_mime) <> ''),
  constraint versiones_tamano_positivo check (tamano_bytes > 0),
  constraint versiones_huella_sha256_check
    check (huella_sha256 is null or huella_sha256 ~ '^[0-9a-f]{64}$'),
  unique (material_id, numero_version),
  unique (material_id, etiqueta_version),
  unique (ruta_almacenamiento),
  unique (id, material_id)
);

create index versiones_material_creado_idx
  on public.versiones_material (material_id, creado_en desc)
  where archivado_en is null;

create index versiones_creado_por_idx
  on public.versiones_material (creado_por)
  where archivado_en is null;

create index versiones_creado_por_fk_idx on public.versiones_material (creado_por);
create index versiones_archivado_por_idx on public.versiones_material (archivado_por);

create table public.publicaciones_material (
  id bigint generated always as identity primary key,
  material_id bigint not null references public.materiales_educativos(id) on delete restrict,
  version_id bigint,
  estado text not null default 'draft',
  disponible_desde timestamptz,
  disponible_hasta timestamptz,
  publicado_en timestamptz,
  publicado_por uuid references public.perfiles(id) on delete set null,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint publicaciones_version_material_fkey
    foreign key (version_id, material_id)
    references public.versiones_material (id, material_id)
    on delete restrict,
  constraint publicaciones_estado_check
    check (estado in ('draft', 'published', 'archived')),
  constraint publicaciones_disponibilidad_check
    check (disponible_hasta is null or disponible_desde is null or disponible_hasta > disponible_desde),
  constraint publicaciones_fecha_publicacion_check
    check (estado <> 'published' or publicado_en is not null),
  constraint publicaciones_archivado_check
    check ((estado = 'archived') = (archivado_en is not null)),
  unique (id, material_id)
);

create index publicaciones_material_estado_idx
  on public.publicaciones_material (material_id, estado, disponible_desde)
  where archivado_en is null;

create unique index publicaciones_unica_publicada_uidx
  on public.publicaciones_material (material_id)
  where estado = 'published' and archivado_en is null;

create unique index publicaciones_unico_borrador_uidx
  on public.publicaciones_material (material_id)
  where estado = 'draft' and archivado_en is null;

create index publicaciones_version_id_idx
  on public.publicaciones_material (version_id)
  where version_id is not null;

create index publicaciones_material_id_fk_idx on public.publicaciones_material (material_id);
create index publicaciones_publicado_por_idx on public.publicaciones_material (publicado_por);
create index publicaciones_creado_por_idx on public.publicaciones_material (creado_por);
create index publicaciones_archivado_por_idx on public.publicaciones_material (archivado_por);

create table public.destinatarios_material (
  id bigint generated always as identity primary key,
  publicacion_id bigint not null references public.publicaciones_material(id) on delete restrict,
  seccion_id bigint not null references public.secciones(id) on delete restrict,
  curso_seccion_id bigint,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  constraint destinatarios_curso_seccion_fkey
    foreign key (curso_seccion_id, seccion_id)
    references public.cursos_seccion (id, seccion_id)
    on delete restrict
);

-- NULL no participa en una restriccion unique comun; por eso se separan los
-- destinatarios por seccion (Inicial) y por oferta (Primaria/Secundaria).
create unique index destinatarios_publicacion_seccion_uidx
  on public.destinatarios_material (publicacion_id, seccion_id)
  where curso_seccion_id is null;

create unique index destinatarios_publicacion_curso_uidx
  on public.destinatarios_material (publicacion_id, curso_seccion_id)
  where curso_seccion_id is not null;

create index destinatarios_seccion_publicacion_idx
  on public.destinatarios_material (seccion_id, publicacion_id);

create index destinatarios_curso_publicacion_idx
  on public.destinatarios_material (curso_seccion_id, publicacion_id)
  where curso_seccion_id is not null;

create index destinatarios_publicacion_id_fk_idx on public.destinatarios_material (publicacion_id);
create index destinatarios_creado_por_idx on public.destinatarios_material (creado_por);

-- -----------------------------------------------------------------------------
-- Entrega y trazabilidad de materiales fisicos
-- -----------------------------------------------------------------------------

create table public.entregas_material_fisico (
  id bigint generated always as identity primary key,
  material_id bigint not null references public.materiales_educativos(id) on delete restrict,
  publicacion_id bigint not null,
  seccion_id bigint not null references public.secciones(id) on delete restrict,
  matricula_id bigint,
  cantidad_planificada smallint not null default 1,
  cantidad_entregada smallint not null default 0,
  estado text not null default 'pending',
  fecha_entrega date,
  recibido_por text,
  notas text,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  entregado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  archivado_en timestamptz,
  archivado_por uuid references public.perfiles(id) on delete set null,
  constraint entregas_publicacion_material_fkey
    foreign key (publicacion_id, material_id)
    references public.publicaciones_material (id, material_id)
    on delete restrict,
  constraint entregas_matricula_seccion_fkey
    foreign key (matricula_id, seccion_id)
    references public.matriculas_estudiantes (id, seccion_id)
    on delete restrict,
  constraint entregas_cantidades_check
    check (
      cantidad_planificada > 0
      and cantidad_entregada >= 0
      and cantidad_entregada <= cantidad_planificada
    ),
  constraint entregas_estado_check
    check (estado in ('pending', 'partial', 'delivered', 'returned')),
  constraint entregas_estado_cantidad_check
    check (
      (estado = 'pending' and cantidad_entregada = 0 and fecha_entrega is null)
      or (
        estado = 'partial'
        and cantidad_entregada > 0
        and cantidad_entregada < cantidad_planificada
        and fecha_entrega is not null
      )
      or (
        estado = 'delivered'
        and cantidad_entregada = cantidad_planificada
        and fecha_entrega is not null
      )
      or (
        estado = 'returned'
        and cantidad_entregada > 0
        and fecha_entrega is not null
      )
    ),
  constraint entregas_recibido_por_no_vacio
    check (recibido_por is null or btrim(recibido_por) <> '')
);

create index entregas_material_seccion_idx
  on public.entregas_material_fisico (material_id, seccion_id, estado)
  where archivado_en is null;

create index entregas_publicacion_id_idx
  on public.entregas_material_fisico (publicacion_id)
  where publicacion_id is not null;

create index entregas_matricula_idx
  on public.entregas_material_fisico (matricula_id, estado)
  where archivado_en is null and matricula_id is not null;

-- Una publicacion solo puede tener un registro activo de entrega por salon o
-- por estudiante. Ademas de proteger la trazabilidad, estos indices eliminan
-- la carrera entre dos coordinadores que registren la misma entrega a la vez.
create unique index entregas_publicacion_seccion_uidx
  on public.entregas_material_fisico (publicacion_id, seccion_id)
  where archivado_en is null and matricula_id is null;

create unique index entregas_publicacion_matricula_uidx
  on public.entregas_material_fisico (publicacion_id, matricula_id)
  where archivado_en is null and matricula_id is not null;

create index entregas_material_id_fk_idx
  on public.entregas_material_fisico (material_id);
create index entregas_seccion_id_fk_idx
  on public.entregas_material_fisico (seccion_id);
create index entregas_matricula_id_fk_idx
  on public.entregas_material_fisico (matricula_id);
create index entregas_creado_por_idx on public.entregas_material_fisico (creado_por);
create index entregas_actualizado_por_idx on public.entregas_material_fisico (actualizado_por);
create index entregas_entregado_por_idx on public.entregas_material_fisico (entregado_por);
create index entregas_archivado_por_idx on public.entregas_material_fisico (archivado_por);

create table public.auditoria_materiales (
  id bigint generated always as identity primary key,
  material_id bigint references public.materiales_educativos(id) on delete set null,
  actor_id uuid,
  actor_nombre text,
  actor_rol text,
  accion text not null,
  tipo_entidad text not null,
  entidad_id bigint,
  detalles jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  constraint auditoria_accion_check
    check (accion in ('created', 'updated', 'published', 'archived', 'distributed', 'deleted')),
  constraint auditoria_tipo_entidad_no_vacio check (btrim(tipo_entidad) <> ''),
  constraint auditoria_detalles_objeto_check check (jsonb_typeof(detalles) = 'object')
);

create index auditoria_material_creado_idx
  on public.auditoria_materiales (material_id, creado_en desc);

create index auditoria_actor_creado_idx
  on public.auditoria_materiales (actor_id, creado_en desc)
  where actor_id is not null;

-- -----------------------------------------------------------------------------
-- Funciones de integridad y automatizacion
-- -----------------------------------------------------------------------------

create or replace function public.establecer_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create or replace function public.validar_rol_perfil_academico()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rol_esperado text;
  perfil_id uuid;
  alcance_asignacion text;
begin
  if tg_table_name = 'asignaciones_docentes' then
    rol_esperado := 'docente';
    perfil_id := new.docente_id;
  else
    rol_esperado := 'estudiante';
    perfil_id := new.estudiante_id;
  end if;

  if tg_table_name = 'asignaciones_docentes' then
    if (new.curso_seccion_id is null) = (new.seccion_id is null) then
      raise exception 'La asignacion docente debe indicar un curso o una seccion, no ambos.';
    end if;

    if new.curso_seccion_id is not null then
      select el.alcance_material
      into alcance_asignacion
      from public.cursos_seccion co
      join public.secciones s on s.id = co.seccion_id
      join public.grados g on g.id = s.grado_id
      join public.niveles_educativos el on el.id = g.nivel_id
      where co.id = new.curso_seccion_id
        and co.activo
        and co.archivado_en is null
        and s.activo;

      if alcance_asignacion is distinct from 'course' then
        raise exception 'Esta asignacion docente debe realizarse directamente por seccion.';
      end if;
    else
      select el.alcance_material
      into alcance_asignacion
      from public.secciones s
      join public.grados g on g.id = s.grado_id
      join public.niveles_educativos el on el.id = g.nivel_id
      where s.id = new.seccion_id
        and s.activo;

      if alcance_asignacion is distinct from 'section' then
        raise exception 'Esta asignacion docente debe realizarse mediante una oferta de curso.';
      end if;
    end if;
  end if;

  -- ON DELETE SET NULL conserva el historial si se retira una credencial.
  if perfil_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.perfiles p
    where p.id = perfil_id
      and p.activo
      and p.rol::text = rol_esperado
  ) then
    raise exception 'El perfil asignado debe estar activo y tener rol %.', rol_esperado;
  end if;

  return new;
end;
$$;

create or replace function public.validar_curso_material()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  asignatura_curso_id bigint;
  alcance_seccion text;
begin
  if new.curso_seccion_id is not null
     and new.seccion_id is not null then
    raise exception 'El material puede pertenecer a un curso o a una seccion, no a ambos.';
  end if;

  if new.seccion_id is not null then
    select el.alcance_material
    into alcance_seccion
    from public.secciones s
    join public.grados g on g.id = s.grado_id
    join public.niveles_educativos el on el.id = g.nivel_id
    where s.id = new.seccion_id
      and s.activo;

    if alcance_seccion is distinct from 'section' then
      raise exception 'Solo los niveles configurados por seccion admiten este alcance.';
    end if;

    return new;
  end if;

  if new.curso_seccion_id is null then
    return new;
  end if;

  select co.asignatura_id
  into asignatura_curso_id
  from public.cursos_seccion co
  where co.id = new.curso_seccion_id
    and co.archivado_en is null;

  if asignatura_curso_id is null then
    raise exception 'La oferta de curso del material no existe o esta archivada.';
  end if;

  if new.asignatura_id is null then
    new.asignatura_id := asignatura_curso_id;
  elsif new.asignatura_id <> asignatura_curso_id then
    raise exception 'La asignatura del material debe coincidir con la oferta de curso.';
  end if;

  return new;
end;
$$;

-- El alcance y el tipo de entrega describen al material completo, no solo a
-- una de sus publicaciones. Una vez que alumnos pudieron verlo, mantenerlos
-- inmutables evita que un borrador nuevo altere la publicacion aun vigente.
create or replace function public.proteger_alcance_material_publicado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alcance_cambiado boolean;
  contexto_operacion text;
begin
  alcance_cambiado := (
    new.tipo_material is distinct from old.tipo_material
    or new.origen is distinct from old.origen
    or new.asignatura_id is distinct from old.asignatura_id
    or new.curso_seccion_id is distinct from old.curso_seccion_id
    or new.seccion_id is distinct from old.seccion_id
  );
  contexto_operacion := current_setting('app.operacion_metadatos_material', true);

  if auth.uid() is not null
     and alcance_cambiado
     and contexto_operacion is distinct from 'update' then
    raise exception 'Use actualizar_metadatos_material para cambiar el alcance del material.';
  end if;

  if alcance_cambiado and exists (
    select 1
    from public.publicaciones_material mr
    where mr.material_id = old.id
      and mr.publicado_en is not null
  ) then
    raise exception 'El curso, el salon y el tipo de entrega no cambian despues de publicar; cree otro material.';
  end if;

  return new;
end;
$$;

create or replace function public.validar_almacenamiento_version_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadatos_objeto jsonb;
  mime_almacenado text;
  tamano_almacenado text;
begin
  select so.metadata
  into metadatos_objeto
  from storage.objects so
  where so.bucket_id = 'school-materials'
    and so.name = new.ruta_almacenamiento;

  if not found then
    raise exception 'El archivo no existe en el bucket privado school-materials.';
  end if;

  mime_almacenado := metadatos_objeto ->> 'mimetype';
  tamano_almacenado := metadatos_objeto ->> 'size';

  if mime_almacenado is not null and lower(mime_almacenado) <> lower(new.tipo_mime) then
    raise exception 'El MIME registrado no coincide con el objeto de Storage.';
  end if;

  if tamano_almacenado is not null
     and tamano_almacenado ~ '^[0-9]+$'
     and tamano_almacenado::bigint <> new.tamano_bytes then
    raise exception 'El tamanio registrado no coincide con el objeto de Storage.';
  end if;

  return new;
end;
$$;

create or replace function public.proteger_archivo_version_material()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.material_id is distinct from old.material_id
     or new.numero_version is distinct from old.numero_version
     or new.etiqueta_version is distinct from old.etiqueta_version
     or new.ruta_almacenamiento is distinct from old.ruta_almacenamiento
     or new.nombre_archivo_original is distinct from old.nombre_archivo_original
     or new.tipo_mime is distinct from old.tipo_mime
     or new.tamano_bytes is distinct from old.tamano_bytes
     or new.huella_sha256 is distinct from old.huella_sha256
     or (
       new.creado_por is distinct from old.creado_por
       and not (new.creado_por is null and auth.uid() is null)
     )
     or new.creado_en is distinct from old.creado_en then
    raise exception 'Un archivo publicado como version es inmutable; cree una version nueva.';
  end if;

  if old.archivado_en is null
     and new.archivado_en is not null
     and exists (
       select 1
       from public.publicaciones_material mr
       where mr.version_id = old.id
         and mr.estado = 'published'
         and mr.archivado_en is null
     ) then
    raise exception 'Archive primero las publicaciones activas que usan esta version.';
  end if;

  if old.archivado_en is null and new.archivado_en is not null then
    new.archivado_en := now();
    new.archivado_por := auth.uid();
  elsif old.archivado_en is not null then
    if new.archivado_en is null then
      raise exception 'Una version archivada no puede reactivarse.';
    end if;

    if new.archivado_en is distinct from old.archivado_en
       or (
         new.archivado_por is distinct from old.archivado_por
         and not (new.archivado_por is null and auth.uid() is null)
       ) then
      raise exception 'La autoria y fecha de archivado son inmutables.';
    end if;
  else
    new.archivado_por := null;
  end if;

  return new;
end;
$$;

create or replace function public.proteger_archivado_logico()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.archivado_en is not null then
      raise exception 'Cree primero el registro activo y archivelo mediante la operacion correspondiente.';
    end if;
    new.archivado_por := null;

    if tg_table_name in (
      'asignaturas',
      'cursos_seccion',
      'matriculas_estudiantes',
      'materiales_educativos',
      'entregas_material_fisico'
    ) and auth.uid() is not null then
      new.actualizado_por := auth.uid();
    end if;

    return new;
  end if;

  if tg_table_name in (
    'asignaturas',
    'cursos_seccion',
    'matriculas_estudiantes',
    'materiales_educativos',
    'entregas_material_fisico'
  ) then
    if new.creado_por is distinct from old.creado_por
       and not (new.creado_por is null and auth.uid() is null) then
      raise exception 'La autoria original es inmutable.';
    end if;

    if auth.uid() is not null then
      new.actualizado_por := auth.uid();
    end if;
  end if;

  if old.archivado_en is null and new.archivado_en is not null then
    if tg_table_name = 'materiales_educativos' then
      if auth.uid() is not null
         and current_setting('app.operacion_publicacion_material', true)
           is distinct from 'archive' then
        raise exception 'Use archivar_material para archivar este material.';
      end if;

      if exists (
        select 1
        from public.publicaciones_material mr
        where mr.material_id = old.id
          and mr.estado in ('draft', 'published')
          and mr.archivado_en is null
      ) then
        raise exception 'Archive primero los borradores y publicaciones de este material.';
      end if;
    end if;

    new.archivado_en := now();
    new.archivado_por := auth.uid();
  elsif old.archivado_en is not null then
    if new.archivado_en is null then
      raise exception 'Un registro archivado no puede reactivarse directamente.';
    end if;

    if new.archivado_en is distinct from old.archivado_en
       or (
         new.archivado_por is distinct from old.archivado_por
         and not (new.archivado_por is null and auth.uid() is null)
       ) then
      raise exception 'La autoria y fecha de archivado son inmutables.';
    end if;
  else
    new.archivado_por := null;
  end if;

  return new;
end;
$$;

-- El archivado de una oferta debe cerrar tambien sus asignaciones docentes.
-- Se obliga a pasar por archivar_curso_seccion para que ambas operaciones
-- ocurran dentro de la misma transaccion.
create or replace function public.proteger_archivado_curso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and old.archivado_en is null
     and new.archivado_en is not null
     and current_setting('app.operacion_academica', true)
       is distinct from 'archive_course' then
    raise exception 'Use archivar_curso_seccion para archivar este curso.';
  end if;

  return new;
end;
$$;

create or replace function public.proteger_autor_asignacion_docente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.asignado_por := auth.uid();
    end if;
    return new;
  end if;

  if new.asignado_por is distinct from old.asignado_por
     and not (new.asignado_por is null and auth.uid() is null) then
    raise exception 'La autoria de la asignacion docente es inmutable.';
  end if;

  return new;
end;
$$;

create or replace function public.validar_publicacion_material()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tipo text;
  publicando boolean;
  archivando boolean;
  contexto_operacion text;
begin
  publicando := new.estado = 'published';
  archivando := new.estado = 'archived';

  if tg_op = 'UPDATE' then
    publicando := new.estado = 'published' and old.estado <> 'published';
    archivando := new.estado = 'archived' and old.estado <> 'archived';

    if new.material_id is distinct from old.material_id
       or new.creado_en is distinct from old.creado_en
       or (
         new.creado_por is distinct from old.creado_por
         and not (new.creado_por is null and auth.uid() is null)
       ) then
      raise exception 'El material y la autoria original de la publicacion son inmutables.';
    end if;

    if old.estado in ('published', 'archived') then
      if new.material_id is distinct from old.material_id
         or new.version_id is distinct from old.version_id
         or new.disponible_desde is distinct from old.disponible_desde
         or new.disponible_hasta is distinct from old.disponible_hasta
         or new.publicado_en is distinct from old.publicado_en
         or (
           new.publicado_por is distinct from old.publicado_por
           and not (new.publicado_por is null and auth.uid() is null)
         )
         or (
           new.creado_por is distinct from old.creado_por
           and not (new.creado_por is null and auth.uid() is null)
         )
         or new.creado_en is distinct from old.creado_en then
        raise exception 'Una publicacion emitida es inmutable; archivela y cree otra.';
      end if;

      if old.estado = 'archived' and new.estado <> 'archived' then
        raise exception 'Una publicacion archivada no puede reactivarse.';
      end if;

      if old.estado = 'archived'
         and (
           new.archivado_en is distinct from old.archivado_en
           or (
             new.archivado_por is distinct from old.archivado_por
             and not (new.archivado_por is null and auth.uid() is null)
           )
         ) then
        raise exception 'La autoria y fecha de archivado son inmutables.';
      end if;

      if old.estado = 'published' and new.estado not in ('published', 'archived') then
        raise exception 'Una publicacion solo puede mantenerse publicada o archivarse.';
      end if;
    end if;
  end if;

  contexto_operacion := current_setting('app.operacion_publicacion_material', true);

  if auth.uid() is not null then
    if publicando and contexto_operacion is distinct from 'publish' then
      raise exception 'Use publicar_material para emitir una publicacion.';
    end if;

    if archivando
       and (
         contexto_operacion is null
         or contexto_operacion not in ('publish', 'archive')
       ) then
      raise exception 'Use una operacion atomica para archivar publicaciones.';
    end if;
  end if;

  if new.estado = 'published' then
    select lm.tipo_material
    into tipo
    from public.materiales_educativos lm
    where lm.id = new.material_id
      and lm.archivado_en is null;

    if tipo is null then
      raise exception 'No se puede publicar un material inexistente o archivado.';
    end if;

    if tipo in ('digital', 'mixed') and new.version_id is null then
      raise exception 'Un material digital o mixto necesita una version de archivo.';
    end if;

    if tipo = 'physical' and new.version_id is not null then
      raise exception 'Un material exclusivamente fisico no debe apuntar a un archivo.';
    end if;

    if new.version_id is not null and not exists (
      select 1
      from public.versiones_material mv
      where mv.id = new.version_id
        and mv.material_id = new.material_id
        and mv.archivado_en is null
    ) then
      raise exception 'La version seleccionada no existe, no corresponde o esta archivada.';
    end if;

    if not exists (
      select 1
      from public.destinatarios_material mt
      where mt.publicacion_id = new.id
    ) then
      raise exception 'Agregue al menos un destinatario antes de publicar.';
    end if;

    if publicando then
      new.publicado_en := now();
      new.publicado_por := auth.uid();
    end if;
  end if;

  if new.estado = 'archived' then
    if archivando then
      new.archivado_en := now();
      new.archivado_por := auth.uid();
    end if;
  elsif new.archivado_en is not null then
    raise exception 'Solo una publicacion con estado archived puede tener fecha de archivado.';
  else
    new.archivado_por := null;
  end if;

  if new.estado = 'draft' then
    new.publicado_en := null;
    new.publicado_por := null;
  elsif tg_op = 'INSERT' and new.estado = 'archived' then
    new.publicado_en := null;
    new.publicado_por := null;
  end if;

  return new;
end;
$$;

create or replace function public.validar_destinatario_material()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  alcance_nivel text;
  estado_publicacion text;
  asignatura_publicacion_id bigint;
  curso_seccion_material_id bigint;
  seccion_material_id bigint;
  asignatura_curso_id bigint;
begin
  select mr.estado, lm.asignatura_id, lm.curso_seccion_id, lm.seccion_id
  into estado_publicacion, asignatura_publicacion_id, curso_seccion_material_id, seccion_material_id
  from public.publicaciones_material mr
  join public.materiales_educativos lm on lm.id = mr.material_id
  where mr.id = new.publicacion_id;

  if estado_publicacion is null then
    raise exception 'La publicacion indicada no existe.';
  end if;

  if estado_publicacion <> 'draft' then
    raise exception 'Los destinatarios solo pueden modificarse mientras la publicacion es borrador.';
  end if;

  if curso_seccion_material_id is not null
     and new.curso_seccion_id is distinct from curso_seccion_material_id then
    raise exception 'El destinatario debe coincidir con el curso del material.';
  end if;

  if seccion_material_id is not null
     and (
       new.seccion_id is distinct from seccion_material_id
       or new.curso_seccion_id is not null
     ) then
    raise exception 'El destinatario debe coincidir con el salon del material.';
  end if;

  select el.alcance_material
  into alcance_nivel
  from public.secciones s
  join public.grados g on g.id = s.grado_id
  join public.niveles_educativos el on el.id = g.nivel_id
  where s.id = new.seccion_id
    and s.activo;

  if alcance_nivel is null then
    raise exception 'La seccion indicada no existe o esta inactiva.';
  end if;

  if alcance_nivel = 'section' and new.curso_seccion_id is not null then
    raise exception 'En Inicial los materiales se publican por seccion, sin oferta de curso.';
  elsif alcance_nivel = 'course' and new.curso_seccion_id is null then
    raise exception 'En Primaria y Secundaria debe indicar una oferta de curso.';
  end if;

  if new.curso_seccion_id is not null then
    select co.asignatura_id
    into asignatura_curso_id
    from public.cursos_seccion co
    where co.id = new.curso_seccion_id
      and co.seccion_id = new.seccion_id
      and co.activo
      and co.archivado_en is null;

    if asignatura_curso_id is null then
      raise exception 'La oferta no pertenece a la seccion o esta inactiva.';
    end if;

    if asignatura_publicacion_id is not null and asignatura_publicacion_id <> asignatura_curso_id then
      raise exception 'La asignatura del material no coincide con el curso destinatario.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.proteger_eliminacion_destinatario()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.publicaciones_material mr
    where mr.id = old.publicacion_id
      and mr.estado <> 'draft'
  ) then
    raise exception 'No se pueden retirar destinatarios de una publicacion emitida.';
  end if;

  return old;
end;
$$;

create or replace function public.proteger_autor_destinatario()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.creado_por is distinct from old.creado_por
     and not (new.creado_por is null and auth.uid() is null) then
    raise exception 'La autoria original del destinatario es inmutable.';
  end if;

  return new;
end;
$$;

create or replace function public.validar_entrega_material_fisico()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  validar_enlace boolean := true;
  validar_matricula boolean := true;
begin
  if tg_op = 'UPDATE' then
    validar_enlace := new.material_id is distinct from old.material_id
      or new.publicacion_id is distinct from old.publicacion_id
      or new.seccion_id is distinct from old.seccion_id;

    validar_matricula := new.matricula_id is distinct from old.matricula_id
      or new.seccion_id is distinct from old.seccion_id
      or (
        new.estado in ('partial', 'delivered')
        and old.estado is distinct from new.estado
      );
  end if;

  if validar_enlace then
    if not exists (
      select 1
      from public.materiales_educativos lm
      where lm.id = new.material_id
        and lm.tipo_material in ('physical', 'mixed')
        and lm.archivado_en is null
    ) then
      raise exception 'La distribucion requiere un material fisico o mixto vigente.';
    end if;

    if not exists (
      select 1
      from public.publicaciones_material mr
      join public.destinatarios_material mt on mt.publicacion_id = mr.id
      where mr.id = new.publicacion_id
        and mr.material_id = new.material_id
        and mr.estado = 'published'
        and mr.archivado_en is null
        and (mr.disponible_desde is null or mr.disponible_desde <= now())
        and (mr.disponible_hasta is null or mr.disponible_hasta > now())
        and mt.seccion_id = new.seccion_id
    ) then
      raise exception 'La publicacion fisica no esta vigente o no corresponde a esta seccion.';
    end if;
  end if;

  if new.matricula_id is not null
     and validar_matricula
     and not exists (
       select 1
       from public.matriculas_estudiantes se
       join public.secciones s
         on s.id = se.seccion_id
        and s.anio_academico_id = se.anio_academico_id
       join public.anios_academicos ay on ay.id = se.anio_academico_id
       where se.id = new.matricula_id
         and se.seccion_id = new.seccion_id
         and se.estado = 'active'
         and se.archivado_en is null
         and s.activo
         and ay.activo
     ) then
    raise exception 'La entrega individual requiere una matricula activa del anio vigente.';
  end if;

  if tg_op = 'INSERT' then
    if new.estado = 'pending' then
      new.fecha_entrega := null;
      new.entregado_por := null;
    else
      new.fecha_entrega := (now() at time zone 'America/Lima')::date;
      new.entregado_por := auth.uid();
    end if;
  elsif old.estado is distinct from new.estado then
    if new.estado in ('partial', 'delivered') then
      new.fecha_entrega := (now() at time zone 'America/Lima')::date;
      new.entregado_por := auth.uid();
    elsif new.estado = 'returned' then
      new.fecha_entrega := old.fecha_entrega;
      new.entregado_por := old.entregado_por;
    else
      new.fecha_entrega := null;
      new.entregado_por := null;
    end if;
  else
    new.fecha_entrega := old.fecha_entrega;
    if not (
      new.entregado_por is null
      and old.entregado_por is not null
      and auth.uid() is null
    ) then
      new.entregado_por := old.entregado_por;
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Autorizacion reutilizable para RLS y Storage
-- -----------------------------------------------------------------------------

create or replace function public.es_gestor_materiales()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico'),
    false
  );
$$;

create or replace function public.docente_tiene_curso(curso_seccion_id_solicitado bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.asignaciones_docentes ta
    join public.cursos_seccion co on co.id = ta.curso_seccion_id
    join public.secciones s on s.id = co.seccion_id
    join public.anios_academicos ay on ay.id = s.anio_academico_id
    join public.perfiles p on p.id = ta.docente_id
    where ta.curso_seccion_id = curso_seccion_id_solicitado
      and ta.docente_id = (select auth.uid())
      and ta.activo
      and ta.archivado_en is null
      and (ta.inicia_en is null or ta.inicia_en <= (now() at time zone 'America/Lima')::date)
      and (ta.termina_en is null or ta.termina_en >= (now() at time zone 'America/Lima')::date)
      and co.activo
      and co.archivado_en is null
      and s.activo
      and ay.activo
      and p.activo
      and p.rol::text = 'docente'
  );
$$;

create or replace function public.docente_tiene_seccion(seccion_id_solicitada bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.asignaciones_docentes ta
    join public.perfiles p on p.id = ta.docente_id
    left join public.cursos_seccion co on co.id = ta.curso_seccion_id
    join public.secciones s
      on s.id = coalesce(ta.seccion_id, co.seccion_id)
    join public.anios_academicos ay on ay.id = s.anio_academico_id
    where s.id = seccion_id_solicitada
      and ta.docente_id = (select auth.uid())
      and ta.activo
      and ta.archivado_en is null
      and (ta.inicia_en is null or ta.inicia_en <= (now() at time zone 'America/Lima')::date)
      and (ta.termina_en is null or ta.termina_en >= (now() at time zone 'America/Lima')::date)
      and s.activo
      and ay.activo
      and (
        ta.seccion_id is not null
        or (co.activo and co.archivado_en is null)
      )
      and p.activo
      and p.rol::text = 'docente'
  );
$$;

create or replace function public.estudiante_tiene_seccion(seccion_id_solicitada bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matriculas_estudiantes se
    join public.secciones s on s.id = se.seccion_id
    join public.anios_academicos ay on ay.id = se.anio_academico_id
    join public.perfiles p on p.id = se.estudiante_id
    where se.seccion_id = seccion_id_solicitada
      and se.estudiante_id = (select auth.uid())
      and se.estado = 'active'
      and se.archivado_en is null
      and s.activo
      and ay.activo
      and p.activo
      and p.rol::text = 'estudiante'
  );
$$;

create or replace function public.puede_leer_curso_seccion(curso_seccion_id_solicitado bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.es_gestor_materiales())
    or (select public.docente_tiene_curso(curso_seccion_id_solicitado))
    or exists (
      select 1
      from public.cursos_seccion co
      where co.id = curso_seccion_id_solicitado
        and co.activo
        and co.archivado_en is null
        and (select public.estudiante_tiene_seccion(co.seccion_id))
    );
$$;

create or replace function public.puede_leer_asignatura(asignatura_id_solicitada bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.es_gestor_materiales())
    or exists (
      select 1
      from public.cursos_seccion co
      where co.asignatura_id = asignatura_id_solicitada
        and co.activo
        and co.archivado_en is null
        and (
          (select public.docente_tiene_curso(co.id))
          or (select public.estudiante_tiene_seccion(co.seccion_id))
        )
    );
$$;

create or replace function public.docente_puede_gestionar_material(material_id_solicitado bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.materiales_educativos lm
    where lm.id = material_id_solicitado
      and lm.origen = 'teacher_extra'
      and lm.creado_por = (select auth.uid())
      and (
        (
          lm.curso_seccion_id is not null
          and lm.seccion_id is null
          and (select public.docente_tiene_curso(lm.curso_seccion_id))
        )
        or (
          lm.seccion_id is not null
          and lm.curso_seccion_id is null
          and (select public.docente_tiene_seccion(lm.seccion_id))
        )
      )
  );
$$;

create or replace function public.puede_gestionar_publicacion(publicacion_id_solicitada bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.es_gestor_materiales())
    or exists (
      select 1
      from public.publicaciones_material mr
      where mr.id = publicacion_id_solicitada
        and (select public.docente_puede_gestionar_material(mr.material_id))
    );
$$;

create or replace function public.puede_leer_publicacion(publicacion_id_solicitada bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.es_gestor_materiales())
    or exists (
      select 1
      from public.publicaciones_material mr
      join public.materiales_educativos lm on lm.id = mr.material_id
      where mr.id = publicacion_id_solicitada
        and lm.archivado_en is null
        and (select public.docente_puede_gestionar_material(mr.material_id))
    )
    or exists (
      select 1
      from public.publicaciones_material mr
      join public.materiales_educativos lm on lm.id = mr.material_id
      join public.destinatarios_material mt on mt.publicacion_id = mr.id
      left join public.cursos_seccion co on co.id = mt.curso_seccion_id
      where mr.id = publicacion_id_solicitada
        and mr.estado = 'published'
        and mr.archivado_en is null
        and lm.archivado_en is null
        and (
          mt.curso_seccion_id is null
          or (co.activo and co.archivado_en is null)
        )
        and (mr.disponible_desde is null or mr.disponible_desde <= now())
        and (mr.disponible_hasta is null or mr.disponible_hasta > now())
        and (
          (
            mt.curso_seccion_id is not null
            and (select public.docente_tiene_curso(mt.curso_seccion_id))
          )
          or (
            mt.curso_seccion_id is null
            and (select public.docente_tiene_seccion(mt.seccion_id))
          )
          or (select public.estudiante_tiene_seccion(mt.seccion_id))
        )
    );
$$;

create or replace function public.puede_leer_material(material_id_solicitado bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.es_gestor_materiales())
    or exists (
      select 1
      from public.materiales_educativos lm
      where lm.id = material_id_solicitado
        and lm.archivado_en is null
        and (select public.docente_puede_gestionar_material(lm.id))
    )
    or exists (
      select 1
      from public.publicaciones_material mr
      where mr.material_id = material_id_solicitado
        and (select public.puede_leer_publicacion(mr.id))
    );
$$;

create or replace function public.puede_leer_version_material(version_id_solicitada bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.es_gestor_materiales())
    or exists (
      select 1
      from public.versiones_material mv
      join public.materiales_educativos lm on lm.id = mv.material_id
      where mv.id = version_id_solicitada
        and mv.archivado_en is null
        and lm.archivado_en is null
        and (select public.docente_puede_gestionar_material(mv.material_id))
    )
    or exists (
      select 1
      from public.publicaciones_material mr
      join public.versiones_material mv on mv.id = mr.version_id
      where mr.version_id = version_id_solicitada
        and mv.archivado_en is null
        and (select public.puede_leer_publicacion(mr.id))
    );
$$;

create or replace function public.puede_leer_archivo_material(ruta_almacenamiento_solicitada text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.es_gestor_materiales())
    or exists (
      select 1
      from public.versiones_material mv
      where mv.ruta_almacenamiento = ruta_almacenamiento_solicitada
        and (select public.puede_leer_version_material(mv.id))
    );
$$;

-- Actualiza los datos editables y, cuando corresponde, su destinatario de
-- borrador dentro de una sola transaccion. Evita guardar el material apuntando
-- a un curso mientras el target queda en otro por un fallo intermedio.
create or replace function public.actualizar_metadatos_material(
  material_id_solicitado bigint,
  publicacion_id_solicitada bigint,
  destinatario_id_solicitado bigint,
  titulo_solicitado text,
  descripcion_solicitada text,
  tipo_material_solicitado text,
  origen_solicitado text,
  asignatura_id_solicitada bigint,
  curso_seccion_id_solicitado bigint,
  seccion_id_solicitada bigint
)
returns public.materiales_educativos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  estado_publicacion text;
  seccion_id_actual bigint;
  curso_seccion_id_actual bigint;
  material_actualizado public.materiales_educativos%rowtype;
begin
  if not (select public.puede_gestionar_publicacion(publicacion_id_solicitada)) then
    raise exception 'No tiene permiso para editar este material.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(material_id_solicitado);

  select mr.estado, mt.seccion_id, mt.curso_seccion_id
  into estado_publicacion, seccion_id_actual, curso_seccion_id_actual
  from public.publicaciones_material mr
  join public.destinatarios_material mt
    on mt.publicacion_id = mr.id
   and mt.id = destinatario_id_solicitado
  where mr.id = publicacion_id_solicitada
    and mr.material_id = material_id_solicitado
    and mr.archivado_en is null
  for update of mr, mt;

  if estado_publicacion is null then
    raise exception 'La publicacion o su destinatario ya no estan disponibles.';
  end if;

  if estado_publicacion <> 'draft'
     and (
       seccion_id_solicitada is distinct from seccion_id_actual
       or curso_seccion_id_solicitado is distinct from curso_seccion_id_actual
     ) then
    raise exception 'El destinatario solo puede cambiarse mientras la publicacion esta en borrador.';
  end if;

  perform pg_catalog.set_config('app.operacion_metadatos_material', 'update', true);

  update public.materiales_educativos lm
  set titulo = btrim(titulo_solicitado),
      descripcion = nullif(btrim(descripcion_solicitada), ''),
      tipo_material = tipo_material_solicitado,
      origen = origen_solicitado,
      asignatura_id = asignatura_id_solicitada,
      curso_seccion_id = curso_seccion_id_solicitado,
      seccion_id = case
        when curso_seccion_id_solicitado is null then seccion_id_solicitada
        else null
      end
  where lm.id = material_id_solicitado
    and lm.archivado_en is null
  returning lm.* into material_actualizado;

  if material_actualizado.id is null then
    raise exception 'El material ya no esta disponible.';
  end if;

  if estado_publicacion = 'draft' then
    update public.destinatarios_material mt
    set seccion_id = seccion_id_solicitada,
        curso_seccion_id = curso_seccion_id_solicitado
    where mt.id = destinatario_id_solicitado
      and mt.publicacion_id = publicacion_id_solicitada;

    if not found then
      raise exception 'No fue posible actualizar el destinatario del borrador.';
    end if;

    if tipo_material_solicitado = 'physical' then
      update public.publicaciones_material mr
      set version_id = null
      where mr.id = publicacion_id_solicitada
        and mr.estado = 'draft'
        and mr.archivado_en is null;
    end if;
  end if;

  return material_actualizado;
end;
$$;

-- Crea o reutiliza el borrador de una nueva version y copia sus destinatarios
-- en una sola transaccion. El lock y el indice parcial evitan dos borradores.
create or replace function public.crear_o_reutilizar_borrador_material(
  material_id_solicitado bigint,
  publicacion_origen_id_solicitada bigint,
  version_id_solicitada bigint
)
returns public.publicaciones_material
language plpgsql
security invoker
set search_path = ''
as $$
declare
  publicacion_borrador public.publicaciones_material%rowtype;
  cantidad_destinatarios integer;
begin
  if not (select public.puede_gestionar_publicacion(publicacion_origen_id_solicitada)) then
    raise exception 'No tiene permiso para versionar este material.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(material_id_solicitado);

  if not exists (
    select 1
    from public.materiales_educativos lm
    where lm.id = material_id_solicitado
      and lm.tipo_material in ('digital', 'mixed')
      and lm.archivado_en is null
  ) then
    raise exception 'Un material exclusivamente fisico no admite versiones de archivo.';
  end if;

  if not exists (
    select 1
    from public.publicaciones_material mr
    where mr.id = publicacion_origen_id_solicitada
      and mr.material_id = material_id_solicitado
      and mr.archivado_en is null
  ) then
    raise exception 'La publicacion de origen ya no esta disponible.';
  end if;

  if not exists (
    select 1
    from public.versiones_material mv
    where mv.id = version_id_solicitada
      and mv.material_id = material_id_solicitado
      and mv.archivado_en is null
  ) then
    raise exception 'La version no pertenece al material o esta archivada.';
  end if;

  select mr.*
  into publicacion_borrador
  from public.publicaciones_material mr
  where mr.material_id = material_id_solicitado
    and mr.estado = 'draft'
    and mr.archivado_en is null
  for update;

  if publicacion_borrador.id is not null then
    update public.publicaciones_material mr
    set version_id = version_id_solicitada
    where mr.id = publicacion_borrador.id
    returning mr.* into publicacion_borrador;
    return publicacion_borrador;
  end if;

  select count(*)::integer
  into cantidad_destinatarios
  from public.destinatarios_material mt
  where mt.publicacion_id = publicacion_origen_id_solicitada;

  if cantidad_destinatarios = 0 then
    raise exception 'La publicacion de origen no tiene destinatarios para copiar.';
  end if;

  insert into public.publicaciones_material (
    material_id,
    version_id,
    estado,
    creado_por
  )
  values (
    material_id_solicitado,
    version_id_solicitada,
    'draft',
    auth.uid()
  )
  returning * into publicacion_borrador;

  insert into public.destinatarios_material (
    publicacion_id,
    seccion_id,
    curso_seccion_id,
    creado_por
  )
  select
    publicacion_borrador.id,
    mt.seccion_id,
    mt.curso_seccion_id,
    auth.uid()
  from public.destinatarios_material mt
  where mt.publicacion_id = publicacion_origen_id_solicitada;

  return publicacion_borrador;
end;
$$;

-- Archiva un curso por seccion junto con sus asignaciones docentes activas.
-- La funcion impide el archivado si el curso aun tiene materiales o
-- publicaciones activas vinculadas.
create or replace function public.archivar_curso_seccion(curso_seccion_id_solicitado bigint)
returns public.cursos_seccion
language plpgsql
security definer
set search_path = ''
as $$
declare
  curso_archivado public.cursos_seccion%rowtype;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'No tiene permiso para archivar cursos.';
  end if;

  perform pg_catalog.set_config('app.operacion_academica', 'archive_course', true);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('teaching:course:' || curso_seccion_id_solicitado::text, 0)
  );

  perform 1
  from public.cursos_seccion co
  where co.id = curso_seccion_id_solicitado
    and co.archivado_en is null
  for update;

  if not found then
    raise exception 'El curso ya no esta disponible.';
  end if;

  if exists (
    select 1
    from public.materiales_educativos lm
    where lm.curso_seccion_id = curso_seccion_id_solicitado
      and lm.archivado_en is null
  ) then
    raise exception 'No se puede archivar: el curso todavia tiene materiales activos.';
  end if;

  if exists (
    select 1
    from public.destinatarios_material mt
    join public.publicaciones_material mr on mr.id = mt.publicacion_id
    where mt.curso_seccion_id = curso_seccion_id_solicitado
      and mr.estado in ('draft', 'published')
      and mr.archivado_en is null
  ) then
    raise exception 'No se puede archivar: el curso aparece en una publicacion activa.';
  end if;

  update public.asignaciones_docentes ta
  set activo = false,
      archivado_en = now(),
      archivado_por = auth.uid()
  where ta.curso_seccion_id = curso_seccion_id_solicitado
    and ta.activo
    and ta.archivado_en is null;

  update public.cursos_seccion co
  set activo = false,
      archivado_en = now(),
      archivado_por = auth.uid(),
      actualizado_por = auth.uid()
  where co.id = curso_seccion_id_solicitado
    and co.archivado_en is null
  returning co.* into curso_archivado;

  return curso_archivado;
end;
$$;

create or replace function public.reemplazar_asignacion_docente(
  curso_seccion_id_solicitado bigint,
  seccion_id_solicitada bigint,
  docente_id_solicitado uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  asignacion_id bigint;
  clave_bloqueo text;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'No tiene permiso para asignar docentes.';
  end if;

  if (curso_seccion_id_solicitado is null) = (seccion_id_solicitada is null) then
    raise exception 'Indique un curso o una seccion, no ambos.';
  end if;

  clave_bloqueo := case
    when curso_seccion_id_solicitado is not null
      then 'teaching:course:' || curso_seccion_id_solicitado::text
    else 'teaching:section:' || seccion_id_solicitada::text
  end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(clave_bloqueo, 0));

  update public.asignaciones_docentes ta
  set activo = false,
      archivado_en = now(),
      archivado_por = auth.uid()
  where ta.activo
    and ta.archivado_en is null
    and (
      (curso_seccion_id_solicitado is not null and ta.curso_seccion_id = curso_seccion_id_solicitado)
      or (seccion_id_solicitada is not null and ta.seccion_id = seccion_id_solicitada)
    );

  if docente_id_solicitado is null then
    return null;
  end if;

  insert into public.asignaciones_docentes (
    curso_seccion_id,
    seccion_id,
    docente_id,
    rol_asignacion,
    inicia_en,
    activo,
    asignado_por
  )
  values (
    curso_seccion_id_solicitado,
    seccion_id_solicitada,
    docente_id_solicitado,
    'titular',
    (now() at time zone 'America/Lima')::date,
    true,
    auth.uid()
  )
  returning id into asignacion_id;

  return asignacion_id;
end;
$$;

create or replace function public.matricular_estudiante_en_seccion(
  anio_academico_id_solicitado bigint,
  seccion_id_solicitada bigint,
  estudiante_id_solicitado uuid
)
returns public.matriculas_estudiantes
language plpgsql
security definer
set search_path = ''
as $$
declare
  capacidad_seccion smallint;
  ocupados integer;
  nueva_matricula public.matriculas_estudiantes%rowtype;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'No tiene permiso para matricular estudiantes.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('enrollment:section:' || seccion_id_solicitada::text, 0)
  );

  select s.capacidad
  into capacidad_seccion
  from public.secciones s
  where s.id = seccion_id_solicitada
    and s.anio_academico_id = anio_academico_id_solicitado
    and s.activo
  for update;

  if not found then
    raise exception 'La seccion no existe, no pertenece al anio o esta inactiva.';
  end if;

  select count(*)::integer
  into ocupados
  from public.matriculas_estudiantes se
  where se.seccion_id = seccion_id_solicitada
    and se.anio_academico_id = anio_academico_id_solicitado
    and se.estado = 'active'
    and se.archivado_en is null;

  if capacidad_seccion is not null and ocupados >= capacidad_seccion then
    raise exception 'La seccion alcanzo su capacidad maxima de % estudiantes.', capacidad_seccion;
  end if;

  insert into public.matriculas_estudiantes (
    anio_academico_id,
    seccion_id,
    estudiante_id,
    estado,
    matriculado_en,
    creado_por,
    actualizado_por
  )
  values (
    anio_academico_id_solicitado,
    seccion_id_solicitada,
    estudiante_id_solicitado,
    'active',
    (now() at time zone 'America/Lima')::date,
    auth.uid(),
    auth.uid()
  )
  returning * into nueva_matricula;

  return nueva_matricula;
end;
$$;

create or replace function public.retirar_matricula(matricula_id_solicitada bigint)
returns public.matriculas_estudiantes
language plpgsql
security definer
set search_path = ''
as $$
declare
  matricula_retirada public.matriculas_estudiantes%rowtype;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'No tiene permiso para retirar matriculas.';
  end if;

  update public.matriculas_estudiantes se
  set estado = 'withdrawn',
      retirado_en = (now() at time zone 'America/Lima')::date,
      actualizado_por = auth.uid()
  where se.id = matricula_id_solicitada
    and se.estado = 'active'
    and se.archivado_en is null
  returning se.* into matricula_retirada;

  if matricula_retirada.id is null then
    raise exception 'La matricula ya no esta activa.';
  end if;

  return matricula_retirada;
end;
$$;

-- Publica de forma atomica: bloquea el material, archiva la publicacion vigente
-- y emite el borrador solicitado. Los triggers vuelven a validar version y
-- destinatarios dentro de la misma transaccion.
create or replace function public.publicar_material(publicacion_id_solicitada bigint)
returns public.publicaciones_material
language plpgsql
security invoker
set search_path = ''
as $$
declare
  material_publicacion_id bigint;
  estado_publicacion text;
  publicacion_publicada public.publicaciones_material%rowtype;
begin
  if not (select public.puede_gestionar_publicacion(publicacion_id_solicitada)) then
    raise exception 'No tiene permiso para publicar este material.';
  end if;

  select mr.material_id, mr.estado
  into material_publicacion_id, estado_publicacion
  from public.publicaciones_material mr
  where mr.id = publicacion_id_solicitada;

  if material_publicacion_id is null then
    raise exception 'La publicacion solicitada no existe.';
  end if;

  if estado_publicacion <> 'draft' then
    raise exception 'Solo se puede publicar un borrador.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(material_publicacion_id);
  perform pg_catalog.set_config('app.operacion_publicacion_material', 'publish', true);

  update public.publicaciones_material mr
  set estado = 'archived',
      archivado_en = now(),
      archivado_por = auth.uid()
  where mr.material_id = material_publicacion_id
    and mr.id <> publicacion_id_solicitada
    and mr.estado = 'published'
    and mr.archivado_en is null;

  update public.publicaciones_material mr
  set estado = 'published',
      publicado_en = now(),
      publicado_por = auth.uid()
  where mr.id = publicacion_id_solicitada
  returning mr.* into publicacion_publicada;

  if publicacion_publicada.id is null then
    raise exception 'No fue posible publicar el material.';
  end if;

  return publicacion_publicada;
end;
$$;

-- El archivado es reversible solo mediante una nueva publicacion/material. No
-- elimina objetos de Storage ni versiones, por lo que conserva la auditoria.
create or replace function public.archivar_material(material_id_solicitado bigint)
returns public.materiales_educativos
language plpgsql
security invoker
set search_path = ''
as $$
declare
  material_archivado public.materiales_educativos%rowtype;
begin
  if not (
    (select public.es_gestor_materiales())
    or (select public.docente_puede_gestionar_material(material_id_solicitado))
  ) then
    raise exception 'No tiene permiso para archivar este material.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(material_id_solicitado);
  perform pg_catalog.set_config('app.operacion_publicacion_material', 'archive', true);

  update public.publicaciones_material mr
  set estado = 'archived',
      archivado_en = now(),
      archivado_por = auth.uid()
  where mr.material_id = material_id_solicitado
    and mr.estado in ('draft', 'published')
    and mr.archivado_en is null;

  update public.materiales_educativos lm
  set archivado_en = coalesce(lm.archivado_en, now()),
      archivado_por = coalesce(lm.archivado_por, auth.uid()),
      actualizado_por = auth.uid()
  where lm.id = material_id_solicitado
  returning lm.* into material_archivado;

  if material_archivado.id is null then
    raise exception 'El material solicitado no existe o no es visible.';
  end if;

  return material_archivado;
end;
$$;

-- -----------------------------------------------------------------------------
-- Auditoria automatica e inmutable
-- -----------------------------------------------------------------------------

create or replace function public.registrar_cambio_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  datos_fila jsonb;
  datos_anteriores jsonb;
  accion_auditoria text;
  material_auditoria_id bigint;
  actor_auditoria_nombre text;
  actor_auditoria_rol text;
begin
  if tg_op = 'DELETE' then
    datos_fila := to_jsonb(old);
  else
    datos_fila := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    datos_anteriores := to_jsonb(old);
  else
    datos_anteriores := '{}'::jsonb;
  end if;

  accion_auditoria := case
    when tg_op = 'INSERT' then 'created'
    when tg_op = 'DELETE' then 'deleted'
    when tg_op = 'UPDATE'
      and datos_anteriores ->> 'archivado_en' is null
      and datos_fila ->> 'archivado_en' is not null then 'archived'
    when tg_table_name = 'publicaciones_material'
      and tg_op = 'UPDATE'
      and datos_anteriores ->> 'estado' <> 'published'
      and datos_fila ->> 'estado' = 'published' then 'published'
    when tg_table_name = 'entregas_material_fisico'
      and tg_op = 'UPDATE'
      and datos_anteriores ->> 'estado' <> 'delivered'
      and datos_fila ->> 'estado' = 'delivered' then 'distributed'
    else 'updated'
  end;

  material_auditoria_id := case tg_table_name
    when 'materiales_educativos' then (datos_fila ->> 'id')::bigint
    when 'versiones_material' then (datos_fila ->> 'material_id')::bigint
    when 'publicaciones_material' then (datos_fila ->> 'material_id')::bigint
    when 'entregas_material_fisico' then (datos_fila ->> 'material_id')::bigint
    else null
  end;

  -- En un DELETE del registro raiz, conservar entity_id pero no intentar una
  -- FK hacia un material que ya no existe.
  if tg_table_name = 'materiales_educativos' and tg_op = 'DELETE' then
    material_auditoria_id := null;
  end if;

  if tg_table_name = 'destinatarios_material' then
    select mr.material_id
    into material_auditoria_id
    from public.publicaciones_material mr
    where mr.id = (datos_fila ->> 'publicacion_id')::bigint;
  end if;

  select p.nombre_completo, p.rol::text
  into actor_auditoria_nombre, actor_auditoria_rol
  from public.perfiles p
  where p.id = auth.uid();

  insert into public.auditoria_materiales (
    material_id,
    actor_id,
    actor_nombre,
    actor_rol,
    accion,
    tipo_entidad,
    entidad_id,
    detalles
  )
  values (
    material_auditoria_id,
    auth.uid(),
    actor_auditoria_nombre,
    actor_auditoria_rol,
    accion_auditoria,
    tg_table_name,
    (datos_fila ->> 'id')::bigint,
    jsonb_strip_nulls(jsonb_build_object(
      'operacion', lower(tg_op),
      'estado_anterior', datos_anteriores ->> 'estado',
      'estado_nuevo', datos_fila ->> 'estado',
      'numero_version', datos_fila ->> 'numero_version',
      'etiqueta_version', datos_fila ->> 'etiqueta_version',
      'publicacion_id', datos_fila ->> 'publicacion_id',
      'seccion_id', datos_fila ->> 'seccion_id',
      'curso_seccion_id', datos_fila ->> 'curso_seccion_id'
    ))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger asignaturas_establecer_actualizado
before update on public.asignaturas
for each row execute function public.establecer_actualizado_en();

create trigger asignaturas_proteger_archivado
before insert or update on public.asignaturas
for each row execute function public.proteger_archivado_logico();

create trigger cursos_establecer_actualizado
before update on public.cursos_seccion
for each row execute function public.establecer_actualizado_en();

create trigger cursos_proteger_archivado
before insert or update on public.cursos_seccion
for each row execute function public.proteger_archivado_logico();

create trigger cursos_exigir_rpc_archivado
before update on public.cursos_seccion
for each row execute function public.proteger_archivado_curso();

create trigger asignaciones_establecer_actualizado
before update on public.asignaciones_docentes
for each row execute function public.establecer_actualizado_en();

create trigger asignaciones_proteger_archivado
before insert or update on public.asignaciones_docentes
for each row execute function public.proteger_archivado_logico();

create trigger asignaciones_proteger_autor
before insert or update of asignado_por on public.asignaciones_docentes
for each row execute function public.proteger_autor_asignacion_docente();

create trigger matriculas_establecer_actualizado
before update on public.matriculas_estudiantes
for each row execute function public.establecer_actualizado_en();

create trigger matriculas_proteger_archivado
before insert or update on public.matriculas_estudiantes
for each row execute function public.proteger_archivado_logico();

create trigger materiales_establecer_actualizado
before update on public.materiales_educativos
for each row execute function public.establecer_actualizado_en();

create trigger publicaciones_establecer_actualizado
before update on public.publicaciones_material
for each row execute function public.establecer_actualizado_en();

create trigger entregas_establecer_actualizado
before update on public.entregas_material_fisico
for each row execute function public.establecer_actualizado_en();

create trigger asignaciones_validar_perfil
before insert or update of docente_id, curso_seccion_id, seccion_id
on public.asignaciones_docentes
for each row execute function public.validar_rol_perfil_academico();

create trigger matriculas_validar_perfil
before insert or update of estudiante_id on public.matriculas_estudiantes
for each row execute function public.validar_rol_perfil_academico();

create trigger materiales_validar_curso
before insert or update of asignatura_id, curso_seccion_id, seccion_id
on public.materiales_educativos
for each row execute function public.validar_curso_material();

create trigger materiales_proteger_alcance_publicado
before update of tipo_material, origen, asignatura_id, curso_seccion_id, seccion_id
on public.materiales_educativos
for each row execute function public.proteger_alcance_material_publicado();

create trigger materiales_proteger_archivado
before insert or update on public.materiales_educativos
for each row execute function public.proteger_archivado_logico();

create trigger versiones_proteger_archivo
before update on public.versiones_material
for each row execute function public.proteger_archivo_version_material();

create trigger versiones_proteger_archivado_inicial
before insert on public.versiones_material
for each row execute function public.proteger_archivado_logico();

create trigger versiones_validar_almacenamiento
before insert on public.versiones_material
for each row execute function public.validar_almacenamiento_version_material();

create trigger publicaciones_validar
before insert or update on public.publicaciones_material
for each row execute function public.validar_publicacion_material();

create trigger destinatarios_validar
before insert or update of publicacion_id, seccion_id, curso_seccion_id
on public.destinatarios_material
for each row execute function public.validar_destinatario_material();

create trigger destinatarios_proteger_autor
before update of creado_por on public.destinatarios_material
for each row execute function public.proteger_autor_destinatario();

create trigger destinatarios_proteger_eliminacion
before delete on public.destinatarios_material
for each row execute function public.proteger_eliminacion_destinatario();

create trigger entregas_validar
before insert or update on public.entregas_material_fisico
for each row execute function public.validar_entrega_material_fisico();

create trigger entregas_proteger_archivado
before insert or update on public.entregas_material_fisico
for each row execute function public.proteger_archivado_logico();

create trigger materiales_auditoria
after insert or update or delete on public.materiales_educativos
for each row execute function public.registrar_cambio_material();

create trigger versiones_auditoria
after insert or update or delete on public.versiones_material
for each row execute function public.registrar_cambio_material();

create trigger publicaciones_auditoria
after insert or update or delete on public.publicaciones_material
for each row execute function public.registrar_cambio_material();

create trigger destinatarios_auditoria
after insert or update or delete on public.destinatarios_material
for each row execute function public.registrar_cambio_material();

create trigger entregas_auditoria
after insert or update or delete on public.entregas_material_fisico
for each row execute function public.registrar_cambio_material();

create trigger cursos_auditoria
after insert or update or delete on public.cursos_seccion
for each row execute function public.registrar_cambio_material();

create trigger asignaciones_auditoria
after insert or update or delete on public.asignaciones_docentes
for each row execute function public.registrar_cambio_material();

create trigger matriculas_auditoria
after insert or update or delete on public.matriculas_estudiantes
for each row execute function public.registrar_cambio_material();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.asignaturas enable row level security;
alter table public.cursos_seccion enable row level security;
alter table public.asignaciones_docentes enable row level security;
alter table public.matriculas_estudiantes enable row level security;
alter table public.materiales_educativos enable row level security;
alter table public.versiones_material enable row level security;
alter table public.publicaciones_material enable row level security;
alter table public.destinatarios_material enable row level security;
alter table public.entregas_material_fisico enable row level security;
alter table public.auditoria_materiales enable row level security;

-- Coordinacion necesita elegir docentes y estudiantes al asignar cursos y
-- matriculas, pero no obtiene acceso a perfiles familiares o administrativos.
create policy "coordinacion lee perfiles academicos activos"
on public.perfiles for select to authenticated
using (
  (select public.rol_portal_actual())::text = 'coordinador_academico'
  and activo
  and rol::text in ('docente', 'estudiante', 'coordinador_academico')
);

create policy "usuarios autorizados leen asignaturas"
on public.asignaturas for select to authenticated
using ((select public.puede_leer_asignatura(id)));

create policy "gestores crean asignaturas"
on public.asignaturas for insert to authenticated
with check (
  (select public.es_gestor_materiales())
  and creado_por = (select auth.uid())
);

create policy "gestores actualizan asignaturas"
on public.asignaturas for update to authenticated
using ((select public.es_gestor_materiales()))
with check ((select public.es_gestor_materiales()));

create policy "usuarios autorizados leen cursos por seccion"
on public.cursos_seccion for select to authenticated
using ((select public.puede_leer_curso_seccion(id)));

create policy "gestores crean cursos por seccion"
on public.cursos_seccion for insert to authenticated
with check (
  (select public.es_gestor_materiales())
  and creado_por = (select auth.uid())
);

create policy "gestores actualizan cursos por seccion"
on public.cursos_seccion for update to authenticated
using ((select public.es_gestor_materiales()))
with check ((select public.es_gestor_materiales()));

create policy "gestores y docentes asignados leen asignaciones"
on public.asignaciones_docentes for select to authenticated
using (
  (select public.es_gestor_materiales())
  or docente_id = (select auth.uid())
);

create policy "gestores crean asignaciones docentes"
on public.asignaciones_docentes for insert to authenticated
with check (
  (select public.es_gestor_materiales())
  and docente_id is not null
  and asignado_por = (select auth.uid())
);

create policy "gestores actualizan asignaciones docentes"
on public.asignaciones_docentes for update to authenticated
using ((select public.es_gestor_materiales()))
with check ((select public.es_gestor_materiales()));

create policy "usuarios autorizados leen matriculas"
on public.matriculas_estudiantes for select to authenticated
using (
  (select public.es_gestor_materiales())
  or estudiante_id = (select auth.uid())
  or (select public.docente_tiene_seccion(seccion_id))
);

create policy "gestores crean matriculas"
on public.matriculas_estudiantes for insert to authenticated
with check (
  (select public.es_gestor_materiales())
  and estudiante_id is not null
  and creado_por = (select auth.uid())
);

create policy "gestores actualizan matriculas"
on public.matriculas_estudiantes for update to authenticated
using ((select public.es_gestor_materiales()))
with check ((select public.es_gestor_materiales()));

create policy "usuarios autorizados leen materiales educativos"
on public.materiales_educativos for select to authenticated
using ((select public.puede_leer_material(id)));

create policy "usuarios autorizados crean materiales educativos"
on public.materiales_educativos for insert to authenticated
with check (
  (
    (select public.es_gestor_materiales())
    and creado_por = (select auth.uid())
  )
  or (
    (select public.rol_portal_actual())::text = 'docente'
    and origen = 'teacher_extra'
    and tipo_material in ('digital', 'mixed')
    and creado_por = (select auth.uid())
    and (
      (
        curso_seccion_id is not null
        and seccion_id is null
        and (select public.docente_tiene_curso(curso_seccion_id))
      )
      or (
        seccion_id is not null
        and curso_seccion_id is null
        and (select public.docente_tiene_seccion(seccion_id))
      )
    )
  )
);

create policy "usuarios autorizados actualizan materiales educativos"
on public.materiales_educativos for update to authenticated
using (
  (select public.es_gestor_materiales())
  or (select public.docente_puede_gestionar_material(id))
)
with check (
  (select public.es_gestor_materiales())
  or (
    origen = 'teacher_extra'
    and tipo_material in ('digital', 'mixed')
    and creado_por = (select auth.uid())
    and (
      (
        curso_seccion_id is not null
        and seccion_id is null
        and (select public.docente_tiene_curso(curso_seccion_id))
      )
      or (
        seccion_id is not null
        and curso_seccion_id is null
        and (select public.docente_tiene_seccion(seccion_id))
      )
    )
  )
);

create policy "usuarios autorizados leen versiones de material"
on public.versiones_material for select to authenticated
using ((select public.puede_leer_version_material(id)));

create policy "usuarios autorizados crean versiones de material"
on public.versiones_material for insert to authenticated
with check (
  creado_por = (select auth.uid())
  and (
    (
      (select public.es_gestor_materiales())
      and ruta_almacenamiento like ('managed/' || (select auth.uid())::text || '/%')
    )
    or (
      (select public.docente_puede_gestionar_material(material_id))
      and ruta_almacenamiento like ('teachers/' || (select auth.uid())::text || '/%')
    )
  )
);

create policy "usuarios autorizados archivan versiones de material"
on public.versiones_material for update to authenticated
using (
  (select public.es_gestor_materiales())
  or (select public.docente_puede_gestionar_material(material_id))
)
with check (
  (select public.es_gestor_materiales())
  or (select public.docente_puede_gestionar_material(material_id))
);

create policy "usuarios autorizados leen publicaciones de material"
on public.publicaciones_material for select to authenticated
using ((select public.puede_leer_publicacion(id)));

create policy "usuarios autorizados crean publicaciones de material"
on public.publicaciones_material for insert to authenticated
with check (
  creado_por = (select auth.uid())
  and (
    (select public.es_gestor_materiales())
    or (select public.docente_puede_gestionar_material(material_id))
  )
);

create policy "usuarios autorizados actualizan publicaciones de material"
on public.publicaciones_material for update to authenticated
using ((select public.puede_gestionar_publicacion(id)))
with check (
  (select public.es_gestor_materiales())
  or (select public.docente_puede_gestionar_material(material_id))
);

create policy "usuarios autorizados leen destinatarios de material"
on public.destinatarios_material for select to authenticated
using ((select public.puede_leer_publicacion(publicacion_id)));

create policy "usuarios autorizados crean destinatarios de material"
on public.destinatarios_material for insert to authenticated
with check (
  creado_por = (select auth.uid())
  and (select public.puede_gestionar_publicacion(publicacion_id))
  and (
    (select public.es_gestor_materiales())
    or (
      curso_seccion_id is not null
      and (select public.docente_tiene_curso(curso_seccion_id))
    )
    or (
      curso_seccion_id is null
      and (select public.docente_tiene_seccion(seccion_id))
    )
  )
);

create policy "usuarios autorizados actualizan destinatarios de material"
on public.destinatarios_material for update to authenticated
using ((select public.puede_gestionar_publicacion(publicacion_id)))
with check (
  (select public.puede_gestionar_publicacion(publicacion_id))
  and (
    (select public.es_gestor_materiales())
    or (
      curso_seccion_id is not null
      and (select public.docente_tiene_curso(curso_seccion_id))
    )
    or (
      curso_seccion_id is null
      and (select public.docente_tiene_seccion(seccion_id))
    )
  )
);

create policy "usuarios autorizados eliminan destinatarios de borradores"
on public.destinatarios_material for delete to authenticated
using (
  (select public.puede_gestionar_publicacion(publicacion_id))
  and (
    (select public.es_gestor_materiales())
    or (
      curso_seccion_id is not null
      and (select public.docente_tiene_curso(curso_seccion_id))
    )
    or (
      curso_seccion_id is null
      and (select public.docente_tiene_seccion(seccion_id))
    )
  )
);

create policy "usuarios autorizados leen entregas fisicas"
on public.entregas_material_fisico for select to authenticated
using (
  (select public.es_gestor_materiales())
  or (select public.docente_tiene_seccion(seccion_id))
  or exists (
    select 1
    from public.matriculas_estudiantes se
    where se.id = matricula_id
      and se.estudiante_id = (select auth.uid())
  )
);

create policy "gestores crean entregas fisicas"
on public.entregas_material_fisico for insert to authenticated
with check (
  (select public.es_gestor_materiales())
  and creado_por = (select auth.uid())
);

create policy "gestores actualizan entregas fisicas"
on public.entregas_material_fisico for update to authenticated
using ((select public.es_gestor_materiales()))
with check ((select public.es_gestor_materiales()));

create policy "gestores leen auditoria"
on public.auditoria_materiales for select to authenticated
using ((select public.es_gestor_materiales()));

-- Solo destinatarios_material admite DELETE mientras la publicacion es borrador. Los
-- registros de negocio se archivan; una eliminacion fisica queda reservada para
-- mantenimiento con service_role y tambien se captura en la auditoria.

-- -----------------------------------------------------------------------------
-- Privilegios minimos de API
-- -----------------------------------------------------------------------------

revoke all on table
  public.asignaturas,
  public.cursos_seccion,
  public.asignaciones_docentes,
  public.matriculas_estudiantes,
  public.materiales_educativos,
  public.versiones_material,
  public.publicaciones_material,
  public.destinatarios_material,
  public.entregas_material_fisico,
  public.auditoria_materiales
from public, anon;

revoke all on table
  public.asignaturas,
  public.cursos_seccion,
  public.asignaciones_docentes,
  public.matriculas_estudiantes,
  public.materiales_educativos,
  public.versiones_material,
  public.publicaciones_material,
  public.destinatarios_material,
  public.entregas_material_fisico,
  public.auditoria_materiales
from authenticated;

grant select, insert, update on table
  public.asignaturas,
  public.cursos_seccion,
  public.asignaciones_docentes,
  public.matriculas_estudiantes,
  public.materiales_educativos,
  public.versiones_material,
  public.publicaciones_material,
  public.destinatarios_material,
  public.entregas_material_fisico
to authenticated;

-- Las altas, reemplazos y retiros de estas tablas pasan exclusivamente por
-- RPC transaccionales para respetar unicidad, aforo, fechas y auditoria.
revoke insert, update on table
  public.asignaciones_docentes,
  public.matriculas_estudiantes
from authenticated;

grant select on table public.auditoria_materiales to authenticated;
grant delete on table public.destinatarios_material to authenticated;

revoke all on sequence
  public.asignaturas_id_seq,
  public.cursos_seccion_id_seq,
  public.asignaciones_docentes_id_seq,
  public.matriculas_estudiantes_id_seq,
  public.materiales_educativos_id_seq,
  public.versiones_material_id_seq,
  public.publicaciones_material_id_seq,
  public.destinatarios_material_id_seq,
  public.entregas_material_fisico_id_seq,
  public.auditoria_materiales_id_seq
from authenticated;

grant usage, select on sequence
  public.asignaturas_id_seq,
  public.cursos_seccion_id_seq,
  public.asignaciones_docentes_id_seq,
  public.matriculas_estudiantes_id_seq,
  public.materiales_educativos_id_seq,
  public.versiones_material_id_seq,
  public.publicaciones_material_id_seq,
  public.destinatarios_material_id_seq,
  public.entregas_material_fisico_id_seq
to authenticated;

revoke all on sequence
  public.asignaturas_id_seq,
  public.cursos_seccion_id_seq,
  public.asignaciones_docentes_id_seq,
  public.matriculas_estudiantes_id_seq,
  public.materiales_educativos_id_seq,
  public.versiones_material_id_seq,
  public.publicaciones_material_id_seq,
  public.destinatarios_material_id_seq,
  public.entregas_material_fisico_id_seq,
  public.auditoria_materiales_id_seq
from public, anon;

revoke all on function public.es_gestor_materiales() from public, anon, authenticated;
revoke all on function public.docente_tiene_curso(bigint) from public, anon, authenticated;
revoke all on function public.docente_tiene_seccion(bigint) from public, anon, authenticated;
revoke all on function public.estudiante_tiene_seccion(bigint) from public, anon, authenticated;
revoke all on function public.puede_leer_curso_seccion(bigint) from public, anon, authenticated;
revoke all on function public.puede_leer_asignatura(bigint) from public, anon, authenticated;
revoke all on function public.docente_puede_gestionar_material(bigint) from public, anon, authenticated;
revoke all on function public.puede_gestionar_publicacion(bigint) from public, anon, authenticated;
revoke all on function public.puede_leer_publicacion(bigint) from public, anon, authenticated;
revoke all on function public.puede_leer_material(bigint) from public, anon, authenticated;
revoke all on function public.puede_leer_version_material(bigint) from public, anon, authenticated;
revoke all on function public.puede_leer_archivo_material(text) from public, anon, authenticated;
revoke all on function public.actualizar_metadatos_material(bigint, bigint, bigint, text, text, text, text, bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.crear_o_reutilizar_borrador_material(bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.archivar_curso_seccion(bigint) from public, anon, authenticated;
revoke all on function public.reemplazar_asignacion_docente(bigint, bigint, uuid) from public, anon, authenticated;
revoke all on function public.matricular_estudiante_en_seccion(bigint, bigint, uuid) from public, anon, authenticated;
revoke all on function public.retirar_matricula(bigint) from public, anon, authenticated;
revoke all on function public.publicar_material(bigint) from public, anon, authenticated;
revoke all on function public.archivar_material(bigint) from public, anon, authenticated;
revoke all on function public.establecer_actualizado_en() from public, anon, authenticated;
revoke all on function public.validar_rol_perfil_academico() from public, anon, authenticated;
revoke all on function public.validar_curso_material() from public, anon, authenticated;
revoke all on function public.proteger_alcance_material_publicado() from public, anon, authenticated;
revoke all on function public.validar_almacenamiento_version_material() from public, anon, authenticated;
revoke all on function public.proteger_archivo_version_material() from public, anon, authenticated;
revoke all on function public.proteger_archivado_logico() from public, anon, authenticated;
revoke all on function public.proteger_archivado_curso() from public, anon, authenticated;
revoke all on function public.proteger_autor_asignacion_docente() from public, anon, authenticated;
revoke all on function public.validar_publicacion_material() from public, anon, authenticated;
revoke all on function public.validar_destinatario_material() from public, anon, authenticated;
revoke all on function public.proteger_eliminacion_destinatario() from public, anon, authenticated;
revoke all on function public.proteger_autor_destinatario() from public, anon, authenticated;
revoke all on function public.validar_entrega_material_fisico() from public, anon, authenticated;
revoke all on function public.registrar_cambio_material() from public, anon, authenticated;

grant execute on function public.es_gestor_materiales() to authenticated;
grant execute on function public.docente_tiene_curso(bigint) to authenticated;
grant execute on function public.docente_tiene_seccion(bigint) to authenticated;
grant execute on function public.estudiante_tiene_seccion(bigint) to authenticated;
grant execute on function public.puede_leer_curso_seccion(bigint) to authenticated;
grant execute on function public.puede_leer_asignatura(bigint) to authenticated;
grant execute on function public.docente_puede_gestionar_material(bigint) to authenticated;
grant execute on function public.puede_gestionar_publicacion(bigint) to authenticated;
grant execute on function public.puede_leer_publicacion(bigint) to authenticated;
grant execute on function public.puede_leer_material(bigint) to authenticated;
grant execute on function public.puede_leer_version_material(bigint) to authenticated;
grant execute on function public.puede_leer_archivo_material(text) to authenticated;
grant execute on function public.actualizar_metadatos_material(bigint, bigint, bigint, text, text, text, text, bigint, bigint, bigint) to authenticated;
grant execute on function public.crear_o_reutilizar_borrador_material(bigint, bigint, bigint) to authenticated;
grant execute on function public.archivar_curso_seccion(bigint) to authenticated;
grant execute on function public.reemplazar_asignacion_docente(bigint, bigint, uuid) to authenticated;
grant execute on function public.matricular_estudiante_en_seccion(bigint, bigint, uuid) to authenticated;
grant execute on function public.retirar_matricula(bigint) to authenticated;
grant execute on function public.publicar_material(bigint) to authenticated;
grant execute on function public.archivar_material(bigint) to authenticated;

-- Habilita actualizaciones en vivo cuando la publicacion administrada por
-- Supabase existe. El bloque es idempotente y no falla en entornos PostgreSQL
-- locales que no tengan supabase_realtime.
do $$
declare
  tabla_tiempo_real text;
begin
  if exists (
    select 1
    from pg_publication p
    where p.pubname = 'supabase_realtime'
  ) then
    foreach tabla_tiempo_real in array array[
      'perfiles',
      'anios_academicos',
      'niveles_educativos',
      'grados',
      'secciones',
      'asignaturas',
      'cursos_seccion',
      'asignaciones_docentes',
      'matriculas_estudiantes',
      'materiales_educativos',
      'versiones_material',
      'publicaciones_material',
      'destinatarios_material',
      'entregas_material_fisico',
      'auditoria_materiales'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables pt
        where pt.pubname = 'supabase_realtime'
          and pt.schemaname = 'public'
          and pt.tablename = tabla_tiempo_real
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          tabla_tiempo_real
        );
      end if;
    end loop;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage privado para archivos de materiales
-- -----------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'school-materials',
  'school-materials',
  false,
  104857600,
  array[
    'application/pdf',
    'application/epub+zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "usuarios autorizados leen archivos de materiales" on storage.objects;
create policy "usuarios autorizados leen archivos de materiales"
on storage.objects for select to authenticated
using (
  bucket_id = 'school-materials'
  and (select public.puede_leer_archivo_material(name))
);

drop policy if exists "usuarios autorizados suben archivos de materiales" on storage.objects;
create policy "usuarios autorizados suben archivos de materiales"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'school-materials'
  and (
    (
      (select public.es_gestor_materiales())
      and (storage.foldername(name))[1] = 'managed'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
    or (
      (select public.rol_portal_actual())::text = 'docente'
      and (storage.foldername(name))[1] = 'teachers'
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  )
);

-- Los objetos son inmutables desde el cliente: no hay politicas UPDATE ni
-- DELETE. Para reemplazar un PDF se carga otra ruta y se crea versiones_material.
-- La limpieza definitiva, si se define una retencion, se ejecuta con service_role.

comment on column public.niveles_educativos.alcance_material is
  'section para Inicial; course para Primaria, Secundaria y otros niveles por asignatura.';

comment on column public.versiones_material.ruta_almacenamiento is
  'Ruta exacta de storage.objects.name dentro del bucket privado school-materials.';

comment on column public.versiones_material.numero_version is
  'Secuencia entera interna para ordenar versiones de forma estable.';

comment on column public.versiones_material.etiqueta_version is
  'Etiqueta visible semantica, por ejemplo 1, 2.1 o 2.1.3.';

comment on table public.publicaciones_material is
  'Publicacion inmutable de una version concreta; se archiva y reemplaza por otra publicacion.';

comment on table public.auditoria_materiales is
  'Bitacora append-only generada por triggers; no admite escrituras directas del cliente.';
