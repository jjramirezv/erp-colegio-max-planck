# Portal del estudiante

1. Aplicar las migraciones anteriores y luego `migrations/20260923003300_panel_estudiante.sql` en el editor SQL de Supabase.
2. Crear o habilitar la cuenta con rol `estudiante` desde la gestión de usuarios.
3. Vincular su perfil a una matrícula desde Coordinación académica. Asignar cursos, docentes y horarios a su sección.
4. Ingresar con esa cuenta: Inicio, Mis cursos, Horario, Calificaciones, Asistencia, Materiales, Calendario y Comunicados.

El portal consulta información real y no inserta ejemplos. Las notas pueden ser numéricas o literales; no se calcula un promedio sin reglas institucionales. Solo aparecen evaluaciones visibles para estudiantes, no archivadas y distintas de borrador. Las notas y asistencias corresponden exclusivamente a la matrícula del usuario autenticado. Los materiales, calendario y comunicados conservan sus políticas de acceso existentes.

La función `cargar_panel_estudiante()` es de solo lectura, no acepta identificadores de otros usuarios y valida un perfil activo de estudiante. Revoca acceso anónimo. No concede permisos nuevos de escritura ni lectura directa sobre las tablas académicas.

Verificación de interfaz: `npx playwright test tests/student.spec.js`. Las pruebas interceptan Supabase; no validan una base desplegada ni modifican datos reales.
