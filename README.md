# ERP Colegio Max Planck

Portal por roles para Alta Dirección, Coordinación Académica, administración, docentes, estudiantes y familias.

## Desarrollo

```bash
npm install
npm run dev
```

Abra `http://localhost:5174`. Sin credenciales de Supabase, el portal permite ingresar con la cuenta local `direccion@maxplanck.edu.pe` / `Portal2027!`, tanto en desarrollo como en la versión compilada. El archivo `.env.example` incluye esta configuración; no requiere claves externas.

Las cuentas locales se guardan en este navegador y no acceden a los datos remotos. Los módulos que dependen de Supabase necesitan una conexión configurada para consultar o guardar información.

## Activar Supabase y materiales reales

1. Copie `.env.example` como `.env.local` y complete `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los mismos valores públicos usados por la landing del colegio. Mantenga `VITE_ENABLE_DEMO_AUTH=false`; ajuste `VITE_LANDING_URL` solo si ambos portales se publican en dominios distintos.
2. Inicie sesión con `npx supabase login`, vincule el proyecto con `npx supabase link --project-ref ID_DEL_PROYECTO`, revise `npx supabase db push --dry-run` y aplique `npx supabase db push`. Esto ejecuta las migraciones pendientes de `supabase/migrations` en orden.
3. No ejecute datos iniciales. Ingrese con una cuenta de Dirección y cree el año lectivo desde el panel.
4. Cree cada cuenta en Supabase Auth y registre su mismo UUID en `public.perfiles`. Para Coordinación Académica use el rol `coordinador_academico`.
5. Gestione asignaciones y matrículas desde el portal. Las funciones transaccionales y las políticas RLS determinan automáticamente los cursos, salones y materiales visibles.

La guía y el diccionario de tablas están en `supabase/LEEME.md`.

## Portal docente

El docente usa las asignaciones vigentes del año lectivo activo. Dirección o Coordinación debe configurar los cursos, asignar al docente y matricular a los estudiantes. La asistencia diaria se guarda por sección; las calificaciones se registran por evaluación programada o en curso, con la escala numérica o cualitativa del nivel. Las evaluaciones cerradas son de solo consulta.

La migración `20260921003100_panel_docente_real.sql` incorpora las consultas del panel, los resultados por evaluación y el catálogo de comunicados. Los comunicados publicados para el rol docente se consultan desde `comunicados_institucionales`; este cambio no incorpora un editor de comunicados en Dirección. El panel docente no utiliza datos iniciales ni registros guardados en el navegador.

Pruebas de interfaz: `npx playwright install chromium` y `npm run test:teacher`. En Windows también se puede usar Edge instalado con `$env:PLAYWRIGHT_CHANNEL='msedge'`. Las pruebas interceptan las solicitudes de Supabase y no modifican datos remotos. `supabase/tests/panel_docente.sql` prueba persistencia, escalas y permisos dentro de una transacción que termina en `ROLLBACK`.

Ejemplo de vinculación después de crear el usuario en Auth (reemplace el UUID):

```sql
insert into public.perfiles (id, nombre_completo, rol, activo)
values ('UUID-DE-AUTH', 'Nombre del responsable', 'coordinador_academico', true);
```

La tabla pública `admins` de la landing y `perfiles` del ERP cumplen funciones distintas; una cuenta administrativa existente debe vincularse también a `perfiles` para ingresar al portal educativo.

Los archivos se almacenan en el bucket privado `school-materials`. El cliente solo recibe URLs firmadas de corta duración; docentes y estudiantes no pueden recorrer el bucket completo.

La creación o eliminación de cuentas de Auth no debe hacerse con la clave `service_role` en el navegador. Esa operación se implementará mediante una Edge Function protegida para Alta Dirección.
