# Supabase del ERP — guía rápida

Todos los objetos propios del ERP usan español, `snake_case` y nombres sin tildes. Los objetos administrados por Supabase (`auth.users`, `storage.objects`, `authenticated`, `anon` y `service_role`) conservan sus nombres oficiales.

## Orden de ejecución

Ejecute una sola vez y en este orden desde **Supabase → SQL Editor**:

1. `migrations/20260824000100_esquema_base_erp.sql`
2. `migrations/20260824000200_gestion_academica_materiales.sql`
3. `migrations/20260824000300_calendario_academico.sql`
4. `migrations/20260824000400_identidad_institucional.sql`
5. `migrations/20260825000500_marca_institucional_publica.sql`
6. `migrations/20260825000600_gestion_anios_lectivos.sql`

No se ejecuta ninguna semilla. El año lectivo y toda la estructura se crean desde el panel de Dirección.

Si anteriormente ejecutaste la antigua semilla 2026, usa primero `revisar_datos_iniciales_2026.sql`. Solo si el resultado corresponde a registros de prueba, ejecuta `limpiar_datos_iniciales_2026.sql`.

## Tablas principales

| Área | Tablas |
| --- | --- |
| Acceso | `perfiles`, `permisos_modulo_rol` |
| Estructura escolar | `anios_academicos`, `niveles_educativos`, `grados`, `secciones` |
| Gestión académica | `asignaturas`, `cursos_seccion`, `asignaciones_docentes`, `matriculas_estudiantes` |
| Materiales | `materiales_educativos`, `versiones_material`, `publicaciones_material`, `destinatarios_material` |
| Entrega y control | `entregas_material_fisico`, `auditoria_materiales` |
| Calendario | `actividades_calendario`, `destinatarios_actividad` |

La landing ya utiliza una tabla pública llamada `cursos`. Por eso el ERP usa `cursos_seccion`: así se distinguen los cursos informativos de la web y los cursos reales asignados a un grado y salón.

## Archivos y seguridad

- El bucket privado es `school-materials`.
- Los docentes cargan en `teachers/{uuid}/...` y los gestores en `managed/{uuid}/...`.
- Los estudiantes reciben enlaces firmados temporales; no pueden listar el bucket.
- RLS limita los datos por rol, curso, sección y matrícula.
- Nunca coloque la clave `service_role` en `.env`, React ni el navegador.

## Crear el primer acceso

Después de crear una cuenta en **Authentication → Users**, copie su UUID y vincúlelo:

```sql
insert into public.perfiles (id, nombre_completo, rol, activo)
values ('UUID-DE-AUTH', 'Nombre del responsable', 'direccion', true);
```

La cuenta de `direccion` administra toda la información. La creación y eliminación segura de usuarios de Auth se conectará mediante una Edge Function en una etapa posterior.
