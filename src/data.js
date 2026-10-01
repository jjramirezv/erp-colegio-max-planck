export const roles = {
  direccion: "Alta Dirección", coordinador_academico: "Coordinación Académica", administrativo: "Área administrativa", docente: "Docente", estudiante: "Estudiante", familia: "Padre / Madre",
};
export const demoUsers = [
  { id: 1, name: "Elena Vargas", email: "direccion@maxplanck.edu.pe", password: "Portal2027!", role: "direccion", status: "Activo" },
  { id: 2, name: "Carla Rojas", email: "admin@maxplanck.edu.pe", password: "Portal2027!", role: "administrativo", status: "Activo" },
  { id: 3, name: "Juan Pérez", email: "docente@maxplanck.edu.pe", password: "Portal2027!", role: "docente", status: "Activo" },
  { id: 4, name: "Mateo Salazar", email: "estudiante@maxplanck.edu.pe", password: "Portal2027!", role: "estudiante", status: "Activo" },
  { id: 5, name: "Lucía Torres", email: "familia@maxplanck.edu.pe", password: "Portal2027!", role: "familia", status: "Activo" },
  { id: 6, name: "Patricia Salazar", email: "coordinacion@maxplanck.edu.pe", password: "Portal2027!", role: "coordinador_academico", status: "Activo" },
];
export const directionNavigationGroups = [
  {
    label: "Institución",
    items: [
      { id: "Estructura organizacional y académica", label: "Estructura organizacional", ready: true },
    ],
  },
  {
    label: "Organización académica",
    items: [
      { id: "Gestión de años lectivos", label: "Años lectivos", ready: true },
      { id: "Gestión de niveles educativos", label: "Niveles educativos", ready: true },
      { id: "Gestión de grados y secciones", label: "Grados y salones", ready: true },
      { id: "Gestión de turnos y jornadas", label: "Turnos y jornadas", ready: true },
      { id: "Gestión de áreas curriculares y cursos", label: "Áreas y cursos", ready: true },
      { id: "Asignación docente", label: "Asignación docente", ready: true },
      { id: "Gestión de matrícula académica", label: "Matrícula académica", ready: true },
      { id: "Gestión de periodos académicos", label: "Periodos académicos", ready: true },
      { id: "Escalas, criterios y sistemas de evaluación", label: "Escala de notas", ready: true },
    ],
  },
  {
    label: "Planificación",
    items: [
      { id: "Calendario académico institucional", label: "Calendario institucional", ready: true },
      { id: "Configuración de horarios y jornadas", label: "Horarios de clases", ready: true },
      { id: "Gestión de evaluaciones", label: "Evaluaciones y exámenes", ready: true },
      { id: "Comunicados", label: "Comunicados", ready: true },
    ],
  },
  {
    label: "Sistema",
    items: [
      { id: "Identidad institucional", label: "Identidad institucional", ready: true },
      { id: "Parametrización de conceptos institucionales", label: "Conceptos institucionales", ready: true },
      { id: "Configuración de documentos y correlativos", label: "Documentos y correlativos", ready: true },
      { id: "Gestión de usuarios, roles y permisos", label: "Usuarios y accesos", ready: true },
      { id: "Importar estudiantes", label: "Importar estudiantes", ready: true },
      { id: "Accesos de estudiantes", label: "Accesos de estudiantes", ready: true },
      { id: "Parámetros generales del sistema", label: "Parámetros generales", ready: true },
    ],
  },
];

export const academicNavigationGroups = [
  {
    label: "Panel académico",
    items: [
      { id: "Inicio", label: "Inicio académico", ready: true },
      { id: "Calendario", label: "Calendario académico", ready: true },
      { id: "Comunicados", label: "Comunicados", ready: true },
    ],
  },
  {
    label: "Matrícula",
    items: [
      { id: "Gestión de matrícula académica", label: "Matrícula académica", ready: true },
      { id: "Importar estudiantes", label: "Importar estudiantes", ready: true },
      { id: "Accesos de estudiantes", label: "Accesos de estudiantes", ready: true },
      { id: "Historial académico del estudiante", label: "Historial del estudiante", ready: false },
    ],
  },
  {
    label: "Carga académica",
    items: [
      { id: "Gestión de carga académica", label: "Carga académica", ready: true },
      { id: "Gestión de cursos y asignaturas", label: "Cursos y asignaturas", ready: true },
      { id: "Asignación académica de docentes", label: "Asignación docente", ready: true },
      { id: "Gestión de grados y secciones académicas", label: "Grados y salones", ready: true },
      { id: "Gestión de horarios académicos", label: "Horarios académicos", ready: true },
      { id: "Materiales", label: "Materiales educativos", ready: true },
    ],
  },
  {
    label: "Asistencia",
    items: [
      { id: "Gestión de asistencia y tardanzas", label: "Asistencia y tardanzas", ready: true },
      { id: "Gestión de justificaciones", label: "Justificaciones", ready: true },
    ],
  },
  {
    label: "Evaluación",
    items: [
      { id: "Gestión de evaluaciones", label: "Evaluaciones y exámenes", ready: true },
      { id: "Gestión de competencias y criterios de evaluación", label: "Competencias y criterios", ready: false },
      { id: "Registro y administración de calificaciones", label: "Calificaciones", ready: false },
      { id: "Gestión de conclusiones descriptivas", label: "Conclusiones descriptivas", ready: false },
      { id: "Cálculo de promedios y resultados académicos", label: "Promedios y resultados", ready: false },
      { id: "Gestión de periodos de evaluación", label: "Periodos de evaluación", ready: false },
    ],
  },
  {
    label: "Resultados",
    items: [
      { id: "Gestión de libretas académicas", label: "Libretas académicas", ready: false },
      { id: "Seguimiento del rendimiento académico", label: "Seguimiento del rendimiento", ready: false },
      { id: "Reportes y consolidados académicos", label: "Reportes y consolidados", ready: false },
    ],
  },
];

const configuredDirectionModules = directionNavigationGroups.flatMap((group) => group.items.map((item) => item.id));
const configuredAcademicModules = academicNavigationGroups.flatMap((group) => group.items.map((item) => item.id));
export const directionModules = [
  "Calendario académico institucional",
  ...configuredDirectionModules.filter((module) => module !== "Calendario académico institucional"),
];

export const roleModules = {
  direccion: directionModules,
  coordinador_academico: configuredAcademicModules,
  administrativo: ["Inicio", "Calendario", "Matrículas", "Tesorería", "Asistencia", "Comunicados"],
  docente: ["Inicio", "Mis cursos", "Asistencia", "Materiales", "Calificaciones", "Calendario", "Comunicados"],
  estudiante: ["Inicio", "Mis cursos", "Horario", "Calificaciones", "Asistencia", "Materiales", "Calendario", "Comunicados"],
  familia: ["Inicio", "Calificaciones", "Asistencia", "Horario", "Calendario", "Comunicados"],
};
export const announcements = [
  { title: "Evaluación bimestral – Secundaria", text: "Las evaluaciones se realizarán del 21 al 23 de mayo.", date: "20 may" },
  { title: "Reuniones de padres de familia", text: "Revisar horarios asignados por grado en el portal.", date: "18 may" },
  { title: "Taller de habilidades socioemocionales", text: "Dirigido a estudiantes de 4.° y 5.° de secundaria.", date: "17 may" },
];
