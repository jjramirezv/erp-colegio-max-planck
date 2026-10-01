export const students = [
  ["MP-26001", "Alessandra Ríos", "5.° Secundaria A", "María Ríos", "96%", "Activo"],
  ["MP-26002", "Diego Huamán", "4.° Secundaria B", "Carlos Huamán", "91%", "Activo"],
  ["MP-26003", "Valeria Salazar", "2.° Secundaria A", "Lucía Torres", "98%", "Activo"],
  ["MP-26004", "Mateo Salazar", "1.° Secundaria A", "Lucía Torres", "94%", "Activo"],
  ["MP-26005", "Ana Lucía Soto", "6.° Primaria B", "Ricardo Soto", "89%", "Observación"],
  ["MP-26006", "Thiago Flores", "3.° Primaria A", "Rosa Flores", "97%", "Activo"],
];
export const teachers = [
  ["Juan Pérez", "Ciencias y Tecnología", "Secundaria", "5 cursos", "38 h", "Activo"],
  ["Ana López", "Matemática", "Secundaria", "4 cursos", "36 h", "Activo"],
  ["Rosa Medina", "Comunicación", "Primaria", "3 cursos", "30 h", "Activo"],
  ["Luis Quispe", "Ciencias Sociales", "Secundaria", "4 cursos", "34 h", "Activo"],
  ["Mónica Torres", "Inglés", "Primaria y Secundaria", "6 cursos", "40 h", "Activo"],
];
export const teachingAssignments = [
  ["Matemática", "Ana López", "5.° Secundaria A", "Lun / Mié / Vie · 08:00", "32", "Activo"],
  ["Ciencia y Tecnología", "Juan Pérez", "5.° Secundaria A", "Mar / Jue · 09:40", "32", "Activo"],
  ["Comunicación", "Rosa Medina", "5.° Secundaria A", "Lun / Mié · 11:20", "32", "Activo"],
  ["Ciencias Sociales", "Luis Quispe", "4.° Secundaria B", "Mar / Vie · 12:10", "30", "Activo"],
  ["Inglés", "Mónica Torres", "3.° Secundaria A", "Lun / Jue · 14:00", "29", "Activo"],
  ["Tutoría", "Juan Pérez", "5.° Secundaria A", "Viernes · 10:30", "32", "Activo"],
];
export const adminData = {
  Personal: teachers,
  Inventario: [["INV-0412", "Laptop Lenovo 14\"", "Tecnología", "32", "Laboratorio", "Operativo"], ["INV-0388", "Proyector Epson", "Audiovisual", "18", "Aulas", "Operativo"], ["INV-0271", "Microscopio binocular", "Ciencias", "12", "Laboratorio", "Mantenimiento"]],
  Documentos: [["DOC-26081", "Resolución directoral", "Dirección", "18 ago 2026", "Elena Vargas", "Vigente"], ["DOC-26080", "Acta de evaluación", "Académica", "17 ago 2026", "Carla Rojas", "Firmado"], ["DOC-26079", "Constancia de estudios", "Secretaría", "16 ago 2026", "Carla Rojas", "Entregado"]],
  Incidencias: [["INC-0026", "Falta de material de laboratorio", "Media", "Ciencias", "Juan Pérez", "En proceso"], ["INC-0025", "Proyector aula 204", "Alta", "Mantenimiento", "Luis Soto", "Atendido"]],
  Reportes: [["REP-2026-08", "Resumen mensual de asistencia", "Académico", "Agosto 2026", "PDF", "Generado"], ["REP-2026-07", "Estado de recaudación", "Tesorería", "Julio 2026", "XLSX", "Generado"]],
};
export const families = [
  ["María Ríos", "Alessandra Ríos", "Madre", "999 450 112", "mrios@email.pe", "Al día"],
  ["Carlos Huamán", "Diego Huamán", "Padre", "987 213 664", "chuaman@email.pe", "Pendiente"],
  ["Lucía Torres", "Valeria y Mateo Salazar", "Madre", "965 442 818", "ltorres@email.pe", "Al día"],
  ["Ricardo Soto", "Ana Lucía Soto", "Padre", "944 663 275", "rsoto@email.pe", "Al día"],
];
export const enrollments = [
  ["MAT-260184", "Camila Mendoza", "1.° Primaria", "20 ago 2026", "Completa"],
  ["MAT-260183", "Sebastián Vega", "3.° Primaria", "20 ago 2026", "En revisión"],
  ["MAT-260182", "Adriana Campos", "1.° Secundaria", "19 ago 2026", "Completa"],
  ["MAT-260181", "Joaquín Ramos", "4.° Secundaria", "19 ago 2026", "Pendiente"],
];
export const payments = [
  ["PEN-00841", "Carlos Huamán", "Pensión agosto", "S/ 620.00", "15 ago", "Pendiente"],
  ["PEN-00840", "Lucía Torres", "Pensión agosto", "S/ 1,180.00", "14 ago", "Pagado"],
  ["PEN-00839", "María Ríos", "Pensión agosto", "S/ 620.00", "14 ago", "Pagado"],
  ["PEN-00838", "Ricardo Soto", "Pensión agosto", "S/ 620.00", "13 ago", "Pagado"],
];
export const courses = [
  ["Matemática", "Prof. Ana López", "Lun / Mié / Vie · 08:00", "16.8", "2 tareas"],
  ["Ciencia y Tecnología", "Prof. Juan Pérez", "Mar / Jue · 09:40", "17.2", "1 tarea"],
  ["Comunicación", "Prof. Rosa Medina", "Lun / Mié · 11:20", "15.9", "Sin pendientes"],
  ["Ciencias Sociales", "Prof. Luis Quispe", "Mar / Vie · 12:10", "16.5", "1 proyecto"],
];

export const moduleConfig = {
  Administración: { title: "Administración escolar", description: "Operación institucional, recursos y control documental", tabs: ["Matrículas", "Tesorería", "Asistencia", "Personal", "Inventario", "Documentos", "Incidencias", "Reportes"], data: enrollments, columns: ["Código", "Estudiante", "Grado", "Registro", "Estado"] },
  Matrículas: { title: "Matrículas", description: "Inscripciones y expedientes del año académico 2026", data: enrollments, columns: ["Código", "Estudiante", "Grado", "Registro", "Estado"] },
  Tesorería: { title: "Tesorería", description: "Pensiones, comprobantes y seguimiento de saldos", data: payments, columns: ["Operación", "Familia", "Concepto", "Importe", "Fecha", "Estado"] },
  Docentes: { title: "Cursos y docentes responsables", description: "Asignaturas, encargado, grado, horario y estudiantes matriculados", data: teachingAssignments, columns: ["Curso", "Docente encargado", "Grado y sección", "Horario", "Alumnos", "Estado"] },
  Estudiantes: { title: "Estudiantes", description: "Matrícula, sección, apoderado y asistencia", data: students, columns: ["Código", "Estudiante", "Grado y sección", "Apoderado", "Asistencia", "Estado"] },
  Familias: { title: "Familias", description: "Apoderados, estudiantes vinculados y situación de pagos", data: families, columns: ["Apoderado", "Estudiante(s)", "Vínculo", "Teléfono", "Correo", "Estado"] },
  "Mis cursos": { title: "Mis cursos", description: "Clases, docentes, promedios y entregas pendientes", data: courses, columns: ["Curso", "Docente", "Horario", "Promedio", "Pendientes"] },
  Calificaciones: { title: "Calificaciones", description: "Resultados del segundo bimestre", data: courses, columns: ["Curso", "Docente", "Horario", "Promedio", "Pendientes"] },
  "Mis hijos": { title: "Seguimiento familiar", description: "Información académica consolidada de sus estudiantes", data: students.slice(2, 4), columns: ["Código", "Estudiante", "Grado y sección", "Apoderado", "Asistencia", "Estado"] },
};

export const institutionalSeed = {
  identity: { name: "Institución Educativa Privada Max Planck", shortName: "Colegio Max Planck", modularCode: "IEP-1204587", ruc: "20609115697", address: "Huancayo, Junín, Perú", phone: "964 555 210", email: "informes@maxplanck.edu.pe" },
  academic: { year: "2026", start: "2026-03-09", end: "2026-12-18", period: "Bimestres", currentPeriod: "3.er bimestre", scale: "0 a 20", passing: "11", morning: "07:45 – 14:20", afternoon: "13:30 – 18:30" },
  levels: [{ name: "Inicial", grades: "3, 4 y 5 años", sections: 5, active: true }, { name: "Primaria", grades: "1.° a 6.°", sections: 14, active: true }, { name: "Secundaria", grades: "1.° a 5.°", sections: 12, active: true }],
  areas: "Matemática, Comunicación, Ciencia y Tecnología, Ciencias Sociales, Inglés, Arte y Cultura, Educación Física, Educación Religiosa, Tutoría",
  documents: [{ name: "Constancias de estudios", prefix: "CE-2026", next: "0082" }, { name: "Certificados", prefix: "CERT-2026", next: "0041" }, { name: "Recibos internos", prefix: "RI-2026", next: "0328" }, { name: "Expedientes", prefix: "EXP-2026", next: "0157" }],
  system: { timezone: "America/Lima", language: "Español (Perú)", session: "30 minutos", backups: "Diario · 02:00 a. m.", retention: "5 años", notifications: "Portal y correo institucional" },
};
export const compatiblePermissions = {
  direccion: ["Inicio", "Calendario", "Gestión académica", "Administración", "Materiales", "Familias", "Usuarios", "Configuración"],
  coordinador_academico: ["Inicio", "Calendario", "Gestión académica", "Materiales", "Auditoría"],
  administrativo: ["Inicio", "Calendario", "Matrículas", "Tesorería", "Asistencia", "Comunicados"],
  docente: ["Inicio", "Mis cursos", "Asistencia", "Materiales", "Calificaciones", "Calendario", "Comunicados"],
  estudiante: ["Inicio", "Mis cursos", "Horario", "Calificaciones", "Calendario"],
  familia: ["Inicio", "Calendario", "Mis hijos", "Asistencia", "Calificaciones", "Pagos", "Comunicados"],
};
