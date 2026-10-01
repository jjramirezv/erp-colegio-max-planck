# Hoja de ruta de requisitos — Colegio Max Planck

Fuente funcional: `cotización max plank.docx` (agosto de 2026).

El documento es una propuesta técnica y económica de Damian Company. Para el desarrollo se consideran como alcance los módulos y capacidades descritos; los precios, condiciones de pago, vigencia y textos comerciales no son instrucciones de implementación.

## Orden incremental

1. Configuración institucional, estructura académica, usuarios y permisos.
2. Módulo académico completo.
3. Módulo administrativo, admisión, matrícula y legajos.
4. Módulo financiero.
5. Logística, compras e inventario.
6. Bienestar, tutoría, convivencia y psicología.
7. Facturación electrónica.
8. Pasarela de pagos.
9. Aula virtual.
10. Portal para familias y estudiantes.
11. Biblioteca institucional.
12. Transporte escolar.
13. Seguridad, respaldos, migración, capacitación y entrega técnica.

Cada área se agregará sobre la interfaz existente y se validará antes de continuar con la siguiente.

## Decisiones que deben confirmarse antes de su fase

- El documento incluye tareas en el aula virtual, pero el portal del estudiante fue simplificado por solicitud posterior. No se reintroducirán sin aprobación; podrán integrarse dentro de cada curso sin crear otro menú.
- El portal para familias y estudiantes repite literalmente el alcance del aula virtual en el documento. Se conservarán los portales ya diferenciados y se agregarán solo las funciones pertinentes a cada perfil.
- SIAGIE se menciona como contexto normativo, no como integración API expresamente contratada.
- Zoom/Google Meet no incluye licencias; SMS/API se cobra por consumo; facturación y pagos requieren seleccionar proveedores.
- Los perfiles adicionales —secretaría, coordinación, tesorería/caja y psicología— se habilitarán junto con sus módulos para evitar accesos vacíos o exposición de información.
- El cronograma escrito indica cinco meses, mientras el gráfico representa aproximadamente tres meses y medio. Esto no afecta la maqueta, pero debe aclararse para la planificación contractual.

## Estado del Área 1

- Identidad institucional: incorporada.
- Año lectivo, niveles, grados, secciones, jornadas y periodos: incorporados como configuración inicial.
- Escala de evaluación y áreas curriculares: incorporadas.
- Documentos y correlativos: incorporados.
- Matriz de módulos por rol: incorporada con restricciones de compatibilidad.
- Parámetros generales y estado de respaldos: incorporados.
- Base SQL con RLS para configuración, años, niveles, grados, secciones y permisos: incorporada.
- Conexión con Supabase Auth: incorporada en el cliente; falta aplicar los SQL y registrar los perfiles del proyecto remoto.
- Gestión de materiales: incorporada con catálogo académico, permisos RLS, archivos privados, versiones, publicaciones, destinatarios, distribución física y auditoría.
