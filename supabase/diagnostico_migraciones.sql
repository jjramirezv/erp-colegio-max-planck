-- Ejecutar en SQL Editor del proyecto conectado al ERP.
-- Solo consulta metadatos; no modifica tablas ni datos.
-- Para cursos que no aparecen en el portal de Jelibeth, ejecutar también
-- supabase/diagnostico_docente.sql: revisa cuenta, asignaciones y vigencia.
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;

-- Muestra el historial si el proyecto fue gestionado con Supabase CLI.
-- Si las migraciones se ejecutaron manualmente, puede no existir historial.
do $$
declare
  migracion record;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'No existe historial de migraciones. Revisar el esquema antes de aplicar cambios.';
  else
    for migracion in execute
      'select version from supabase_migrations.schema_migrations order by version'
    loop
      raise notice 'Migracion aplicada: %', migracion.version;
    end loop;
  end if;
end;
$$;
