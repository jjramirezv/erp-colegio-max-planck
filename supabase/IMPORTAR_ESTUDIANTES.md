# Carga de estudiantes y matrícula

Dirección y Coordinación Académica disponen de **Importar estudiantes**. Dirección mantiene la gestión general de usuarios; la nueva función solo permite crear o vincular estudiantes y matricularlos. No modifica contraseñas ni roles existentes.

## Flujo

1. Dirección configura año, niveles y grados. Dirección o Coordinación configura salones, capacidad, cursos y asignaciones docentes.
2. En **Importar estudiantes**, seleccionar primero año, nivel, grado y sección. La carga se habilita al completar el destino. Para cargar salones distintos en un archivo, elegir **Varias secciones desde el archivo**.
3. En una sección, la plantilla contiene `dni`, `nombres`, `apellidos`, `correo`, `clave`; el salón seleccionado se aplica a todas las filas, incluso si un archivo anterior incluye columnas de salón. Para varias secciones también son necesarias `nivel`, `grado`, `seccion`, y se pueden descargar los nombres de salones. Guardar desde Excel como **CSV UTF-8**. No admite XLSX directamente. Mantener el DNI como texto de ocho dígitos, incluidos ceros iniciales.
4. Correo y clave pueden quedar vacíos. Se usa `DNI@estudiantes.maxplanck.edu.pe` y el DNI como contraseña. El correo es un identificador de acceso; no se provisiona un buzón. Si ya existe una cuenta, indicar su correo actual: mantiene su contraseña.
5. Cargar hasta 3000 filas (5 MB), revisar errores y confirmar la importación. La revisión no crea cuentas. La importación usa lotes de 10 y muestra el resultado por fila.
6. Descargar resultados y credenciales nuevas antes de abandonar la pantalla. Entregar únicamente la fila correspondiente a cada estudiante. Las claves no se guardan en localStorage, tablas académicas ni auditoría.
7. El estudiante ingresa con el correo y clave entregados. Ve el nombre del perfil, los cursos de su matrícula, las evaluaciones visibles y su asistencia. Los docentes asignados reciben la lista de matriculados al volver a cargar su panel.

## Accesos de estudiantes

Menú **Accesos de estudiantes** (Dirección y Coordinación). Los estudiantes no aparecen en Usuarios y accesos: esa pantalla queda para el personal y las familias.

- **Estudiantes y claves**: filtra por año, nivel, grado, sección o por quienes nunca ingresaron. Selecciona estudiantes y pulsa **Restablecer clave al DNI**: se descarga `credenciales-estudiantes.csv` (DNI, nombre, correo, clave, salón, enlace del portal). Solo afecta cuentas con rol estudiante.
- **Historial de cargas**: cada importación registra archivo, año, responsable, fecha y el resultado de cada fila (cuenta nueva, existente o error). El detalle se puede descargar. No guarda contraseñas.
- Al terminar una importación con cuentas nuevas, el archivo de credenciales se descarga automáticamente.
- Si `correo` y `clave` están vacíos: correo `DNI@estudiantes.maxplanck.edu.pe` y clave igual al DNI.

Migración: `20260924003500_accesos_estudiantes.sql`. Volver a desplegar `importar-estudiantes` y `gestionar-usuario`.

## Errores y reintentos

- DNI/correo repetidos dentro del archivo bloquean la carga hasta corregirlo.
- Se valida rol, estado del usuario, año abierto, salón activo, identidad DNI/correo y vacantes. Otra matrícula activa o completada requiere revisión manual; no se traslada al estudiante silenciosamente.
- La confirmación vuelve a validar y usa el bloqueo de aforo de la matrícula existente. Perfil y matrícula se confirman juntos en una transacción.
- La creación de Auth y la matrícula son operaciones separadas: si falla la matrícula, se informa de la cuenta creada y puede reintentarse. No se borra una cuenta automáticamente por un fallo de red.
- Si se pierde la respuesta de creación, reintentar en la misma pantalla conserva la clave y reconoce las cuentas creadas por ese lote mediante un identificador en `app_metadata`. Al cerrar o recargar se pierde esa información local: para una clave generada no descargada, establecer una nueva desde Usuarios y accesos. No repetir la carga esperando restablecer contraseñas.
- Mantener la pestaña abierta; el progreso está en memoria. Puede pausarse entre lotes. Al recargar, volver a subir el archivo: las cuentas y matrículas existentes no se duplican. Las contraseñas generadas de una sesión anterior no son recuperables.
- Si el archivo supera las vacantes, algunas filas pueden quedar pendientes: se comprueba nuevamente al confirmar cada matrícula. La importación completa no es una única transacción.

## Despliegue y verificación

Migración: `20260923003400_importacion_estudiantes.sql`.
Función: `supabase functions deploy importar-estudiantes --use-api`.
La función valida la sesión con `auth.getUser` y comprueba el rol activo antes de usar las credenciales internas de Supabase. Las RPC que consultan Auth solo admiten `service_role`.

Pruebas: `node --test tests/student-import-unit.test.js tests/student-import-server-unit.test.js`; `npx playwright test tests/student-import.spec.js`.
`supabase/tests/importacion_estudiantes.sql` verifica permisos, perfil, matrícula idempotente y lectura desde el panel en una transacción revertida. Usa la cuenta `estudiante@maxplanck.edu.pe`, una Dirección activa y un salón abierto ya existentes. No crea usuarios de Auth.

## Acceso de padres de familia

Columnas opcionales en el CSV: `dni_apoderado`, `nombre_apoderado`, `parentesco` (madre, padre, apoderado u otro). La plantilla ya las incluye.

- Se crea una cuenta de familia con correo `DNI_APODERADO@familias.maxplanck.edu.pe` y clave inicial igual al DNI del apoderado.
- Hermanos con el mismo `dni_apoderado` quedan vinculados a una sola cuenta; el padre elige a cada hijo desde su portal.
- Si la cuenta ya existe, solo se agrega el vínculo; su clave no cambia.
- El archivo `credenciales-estudiantes.csv` incluye `correo_familia` y `clave_familia`.
- Un fallo al vincular al apoderado no deshace la matrícula: la fila lo indica y basta con volver a cargar el archivo.

El portal de familia muestra, por cada hijo: resumen del día, calificaciones por bimestre, asistencia y horario, además del calendario y los comunicados dirigidos a familias. Es solo de consulta.

Migración: `20260925003700_portal_familia.sql` (tabla `apoderados_estudiantes`, `cargar_panel_familia`, `preparar_apoderado`, `vincular_apoderado`).
