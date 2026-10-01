export function createLocalWorkspace() {
  const year = { id: "year-2026", name: "2026", startsOn: "2026-03-02", endsOn: "2026-12-18", active: true };
  const levels = [
    { id: "level-inicial", name: "Inicial", sortOrder: 1, active: true, materialScope: "section" },
    { id: "level-primaria", name: "Primaria", sortOrder: 2, active: true, materialScope: "course" },
    { id: "level-secundaria", name: "Secundaria", sortOrder: 3, active: true, materialScope: "course" },
  ];
  const gradeNames = {
    "level-inicial": ["3 años", "4 años", "5 años"],
    "level-primaria": ["1.º", "2.º", "3.º", "4.º", "5.º", "6.º"],
    "level-secundaria": ["1.º", "2.º", "3.º", "4.º", "5.º"],
  };
  const grades = levels.flatMap((level) => gradeNames[level.id].map((name, index) => ({
    id: `grade-${level.id}-${index + 1}`, levelId: level.id, name, sortOrder: index + 1,
  })));
  const sections = grades.flatMap((grade) => {
    const base = [{ id: `section-${grade.id}-a`, academicYearId: year.id, gradeId: grade.id, name: "A", shift: "mañana", capacity: 30, active: true }];
    if (grade.id.includes("primaria-5") || grade.id.includes("secundaria-3")) {
      base.push({ id: `section-${grade.id}-b`, academicYearId: year.id, gradeId: grade.id, name: "B", shift: "mañana", capacity: 30, active: true });
    }
    return base;
  });
  const subjects = [
    { id: "subject-mat", code: "MAT", name: "Matemática", active: true },
    { id: "subject-com", code: "COM", name: "Comunicación", active: true },
    { id: "subject-cta", code: "CTA", name: "Ciencia y Tecnología", active: true },
    { id: "subject-soc", code: "SOC", name: "Ciencias Sociales", active: true },
    { id: "subject-ing", code: "ING", name: "Inglés", active: true },
  ];
  const courseSections = sections.filter((section) => {
    const grade = grades.find((item) => item.id === section.gradeId);
    return levels.find((item) => item.id === grade?.levelId)?.materialScope === "course";
  });
  const offerings = courseSections.flatMap((section) => subjects.map((subject, index) => ({
    id: `offering-${section.id}-${subject.code.toLowerCase()}`,
    academicYearId: year.id,
    sectionId: section.id,
    subjectId: subject.id,
    displayName: null,
    weeklyHours: index < 2 ? 5 : index === 4 ? 3 : 4,
    active: true,
    archivedAt: null,
  })));
  const profiles = [
    { id: "teacher-ana", fullName: "Ana López", role: "docente", active: true },
    { id: "teacher-juan", fullName: "Juan Pérez", role: "docente", active: true },
    { id: "teacher-rosa", fullName: "Rosa Mendoza", role: "docente", active: true },
    { id: "teacher-luis", fullName: "Luis Chávez", role: "docente", active: true },
    { id: "student-mateo", fullName: "Mateo Salazar", role: "estudiante", active: true },
    { id: "student-valeria", fullName: "Valeria Salazar", role: "estudiante", active: true },
    { id: "student-alessandra", fullName: "Alessandra Ríos", role: "estudiante", active: true },
    { id: "student-diego", fullName: "Diego Huamán", role: "estudiante", active: true },
    { id: "student-lucia", fullName: "Ana Lucía Soto", role: "estudiante", active: true },
  ];
  const initialSection = sections.find((section) => section.id.includes("primaria-5") && section.name === "A") || sections[0];
  const initialOfferings = offerings.filter((item) => item.sectionId === initialSection.id);
  const assignments = initialOfferings.map((offering, index) => ({
    id: `assignment-${index + 1}`,
    courseOfferingId: offering.id,
    sectionId: null,
    teacherId: profiles[index % 4].id,
    assignmentRole: "titular",
    startsOn: year.startsOn,
    endsOn: null,
    active: true,
    archivedAt: null,
  }));
  const enrollments = profiles.filter((item) => item.role === "estudiante").slice(0, 3).map((student, index) => ({
    id: `enrollment-${index + 1}`,
    academicYearId: year.id,
    sectionId: initialSection.id,
    studentId: student.id,
    status: "active",
    enrolledOn: "2026-03-02",
    withdrawnOn: null,
    archivedAt: null,
  }));
  const audit = [
    { id: "audit-1", actorName: "Carla Mendoza", actorRole: "coordinador_academico", action: "published", entityType: "material_releases", entityId: 82, details: { title: "Guía de fracciones", version: "2.1" }, createdAt: "2026-08-21T14:35:00-05:00" },
    { id: "audit-2", actorName: "Ana López", actorRole: "docente", action: "created", entityType: "material_versions", entityId: 125, details: { filename: "practica-fracciones.pdf" }, createdAt: "2026-08-21T11:12:00-05:00" },
    { id: "audit-3", actorName: "Carla Mendoza", actorRole: "coordinador_academico", action: "updated", entityType: "learning_materials", entityId: 42, details: { field: "description" }, createdAt: "2026-08-20T16:45:00-05:00" },
  ];
  return { years: [year], levels, grades, sections, subjects, offerings, assignments, enrollments, profiles, audit };
}
