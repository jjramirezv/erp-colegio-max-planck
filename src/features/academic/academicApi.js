import { isSupabaseConfigured, supabase } from "../../lib/supabase";

const MANAGED_TABLES = [
  "perfiles",
  "anios_academicos",
  "niveles_educativos",
  "grados",
  "secciones",
  "asignaturas",
  "cursos_seccion",
  "asignaciones_docentes",
  "matriculas_estudiantes",
  "auditoria_materiales",
];

const ENTITY_TYPE_FROM_DB = {
  materiales_educativos: "learning_materials",
  versiones_material: "material_versions",
  publicaciones_material: "material_releases",
  destinatarios_material: "material_targets",
  entregas_material_fisico: "physical_distributions",
  cursos_seccion: "course_offerings",
  asignaciones_docentes: "teaching_assignments",
  matriculas_estudiantes: "student_enrollments",
};

function requireRemote() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase no está configurado para este portal.");
  }
}

export function readableAcademicError(error, fallback = "No se pudo completar la operación.") {
  if (!error) return fallback;
  const code = String(error.code || "").toUpperCase();
  const message = String(error.message || error.details || error);

  if (code === "PGRST205" || /schema cache|could not find the table/i.test(message)) {
    return "Faltan las tablas académicas en Supabase. Aplica primero el esquema y la migración de gestión académica y materiales.";
  }
  if (code === "42501" || /row-level security|permission denied|violates row-level/i.test(message)) {
    return "Tu cuenta no tiene permiso para realizar esta acción. Verifica que el perfil esté activo y tenga rol Dirección o Coordinación Académica.";
  }
  if (code === "23505") return "Ya existe un registro activo con esos datos.";
  if (code === "23503") return "No se puede completar porque el registro todavía está relacionado con otros datos.";
  if (code === "23514") return "Los datos no cumplen las reglas académicas configuradas.";
  return message || fallback;
}

async function unwrap(query, fallback) {
  const { data, error } = await query;
  if (error) throw new Error(readableAcademicError(error, fallback));
  return data;
}

const ACADEMIC_PAGE_SIZE = 500;

async function readAcademicRows(table, columns, { filter, fallback } = {}) {
  const rows = [];
  let lastId = null;

  for (;;) {
    let query = supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .limit(ACADEMIC_PAGE_SIZE);
    if (filter) query = filter(query);
    if (lastId !== null) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw new Error(readableAcademicError(error, fallback || `No se pudo consultar ${table}.`));
    if (!data?.length) return rows;
    rows.push(...data);

    const nextId = data.at(-1).id;
    if (String(nextId) === String(lastId)) throw new Error(`La paginación de ${table} no avanzó.`);
    lastId = nextId;
  }
}

function mapWorkspace(rows) {
  const [years, levels, grades, sections, subjects, offerings, assignments, enrollments, profiles, audit] = rows;
  return {
    years: years.map((item) => ({ id: item.id, name: item.name, startsOn: item.starts_on, endsOn: item.ends_on, active: item.active })),
    levels: levels.map((item) => ({ id: item.id, name: item.name, sortOrder: item.sort_order, active: item.active, materialScope: item.material_scope || "course" })),
    grades: grades.map((item) => ({ id: item.id, levelId: item.level_id, name: item.name, sortOrder: item.sort_order })),
    sections: sections.map((item) => ({ id: item.id, academicYearId: item.academic_year_id, gradeId: item.grade_id, name: item.name, shift: item.shift, capacity: item.capacity, active: item.active })),
    subjects: subjects.map((item) => ({ id: item.id, code: item.code, name: item.name, description: item.description, active: item.active, archivedAt: item.archived_at })),
    offerings: offerings.map((item) => ({ id: item.id, academicYearId: item.academic_year_id, sectionId: item.section_id, subjectId: item.subject_id, displayName: item.display_name, weeklyHours: item.weekly_hours, active: item.active, archivedAt: item.archived_at })),
    assignments: assignments.map((item) => ({ id: item.id, courseOfferingId: item.course_offering_id, sectionId: item.section_id, teacherId: item.teacher_id, assignmentRole: item.assignment_role, startsOn: item.starts_on, endsOn: item.ends_on, active: item.active, archivedAt: item.archived_at })),
    enrollments: enrollments.map((item) => ({ id: item.id, academicYearId: item.academic_year_id, sectionId: item.section_id, studentId: item.student_id, status: item.status, enrolledOn: item.enrolled_on, withdrawnOn: item.withdrawn_on, archivedAt: item.archived_at })),
    profiles: profiles.map((item) => ({ id: item.id, fullName: item.full_name, role: item.role, active: item.active })),
    audit: audit.map((item) => ({ id: item.id, materialId: item.material_id, actorId: item.actor_id, actorName: item.actor_name, actorRole: item.actor_role, action: item.action, entityType: ENTITY_TYPE_FROM_DB[item.entity_type] || item.entity_type, entityId: item.entity_id, details: item.details || {}, createdAt: item.created_at })),
  };
}

export async function loadAcademicWorkspace() {
  requireRemote();
  try {
    const [years, levels, grades, subjects, profiles] = await Promise.all([
      readAcademicRows("anios_academicos", "id,name:nombre,starts_on:inicia_en,ends_on:termina_en,active:activo", { fallback: "No se pudieron cargar los años lectivos." }),
      readAcademicRows("niveles_educativos", "id,name:nombre,sort_order:orden,active:activo,material_scope:alcance_material", { filter: (query) => query.eq("activo", true), fallback: "No se pudieron cargar los niveles." }),
      readAcademicRows("grados", "id,level_id:nivel_id,name:nombre,sort_order:orden", { fallback: "No se pudieron cargar los grados." }),
      readAcademicRows("asignaturas", "id,code:codigo,name:nombre,description:descripcion,active:activo,archived_at:archivado_en", { fallback: "No se pudieron cargar las asignaturas." }),
      readAcademicRows("perfiles", "id,full_name:nombre_completo,role:rol,active:activo", { filter: (query) => query.eq("activo", true).in("rol", ["docente", "estudiante"]), fallback: "No se pudieron cargar los perfiles académicos." }),
    ]);

    const [sections, offerings, assignments, enrollments, audit] = await Promise.all([
      readAcademicRows("secciones", "id,academic_year_id:anio_academico_id,grade_id:grado_id,name:nombre,shift:turno,capacity:capacidad,active:activo", { filter: (query) => query.eq("activo", true), fallback: "No se pudieron cargar las secciones." }),
      readAcademicRows("cursos_seccion", "id,academic_year_id:anio_academico_id,section_id:seccion_id,subject_id:asignatura_id,display_name:nombre_visible,weekly_hours:horas_semanales,active:activo,archived_at:archivado_en", { fallback: "No se pudieron cargar los cursos." }),
      readAcademicRows("asignaciones_docentes", "id,course_offering_id:curso_seccion_id,section_id:seccion_id,teacher_id:docente_id,assignment_role:rol_asignacion,starts_on:inicia_en,ends_on:termina_en,active:activo,archived_at:archivado_en", { fallback: "No se pudieron cargar las asignaciones docentes." }),
      readAcademicRows("matriculas_estudiantes", "id,academic_year_id:anio_academico_id,section_id:seccion_id,student_id:estudiante_id,status:estado,enrolled_on:matriculado_en,withdrawn_on:retirado_en,archived_at:archivado_en", { fallback: "No se pudieron cargar las matrículas." }),
      unwrap(supabase.from("auditoria_materiales").select("id,material_id,actor_id,actor_name:actor_nombre,actor_role:actor_rol,action:accion,entity_type:tipo_entidad,entity_id:entidad_id,details:detalles,created_at:creado_en").order("creado_en", { ascending: false }).limit(200), "No se pudo cargar la auditoría."),
    ]);

    return mapWorkspace([years, levels, grades, sections, subjects, offerings, assignments, enrollments, profiles, audit]);
  } catch (error) {
    throw new Error(readableAcademicError(error, "No se pudo cargar la gestión académica."));
  }
}

export async function createAcademicYear(payload) {
  requireRemote();
  const name = String(payload.name || "").trim();
  const startsOn = payload.startsOn;
  const endsOn = payload.endsOn;
  const periodSystem = payload.periodSystem;

  if (!name || !startsOn || !endsOn) {
    throw new Error("Completa el nombre y las fechas del año lectivo.");
  }
  if (endsOn < startsOn) {
    throw new Error("La fecha de cierre debe ser posterior a la fecha de inicio.");
  }
  if (!["bimestres", "trimestres", "semestres"].includes(periodSystem)) {
    throw new Error("Selecciona un sistema de periodos válido.");
  }

  try {
    return await unwrap(
      supabase
        .from("anios_academicos")
        .insert({
          nombre: name,
          inicia_en: startsOn,
          termina_en: endsOn,
          sistema_periodos: periodSystem,
          activo: true,
        })
        .select("id,name:nombre,starts_on:inicia_en,ends_on:termina_en,active:activo")
        .single(),
      "No se pudo crear el año lectivo.",
    );
  } catch (error) {
    throw new Error(readableAcademicError(error, "No se pudo crear el año lectivo."));
  }
}

function actorId(user) {
  if (!user?.id) throw new Error("La sesión no contiene un perfil válido.");
  return user.id;
}

export async function createCourseOffering(payload, user) {
  requireRemote();
  const userId = actorId(user);
  const code = payload.code.trim().toUpperCase();
  const name = payload.subjectName.trim();
  if (!code || !name) throw new Error("Completa el código y el nombre de la asignatura.");

  try {
    let subject = await unwrap(
      supabase.from("asignaturas").select("id,code:codigo,name:nombre").ilike("codigo", code).is("archivado_en", null).maybeSingle(),
      "No se pudo revisar el catálogo de asignaturas.",
    );

    if (!subject) {
      subject = await unwrap(
        supabase.from("asignaturas").insert({ codigo: code, nombre: name, activo: true, creado_por: userId, actualizado_por: userId }).select("id,code:codigo,name:nombre").single(),
        "No se pudo crear la asignatura.",
      );
    }

    return await unwrap(
      supabase.from("cursos_seccion").insert({
        anio_academico_id: payload.academicYearId,
        seccion_id: payload.sectionId,
        asignatura_id: subject.id,
        nombre_visible: payload.displayName?.trim() || null,
        horas_semanales: payload.weeklyHours ? Number(payload.weeklyHours) : null,
        activo: true,
        creado_por: userId,
        actualizado_por: userId,
      }).select("id").single(),
      "No se pudo crear el curso para esta sección.",
    );
  } catch (error) {
    throw new Error(readableAcademicError(error, "No se pudo crear el curso."));
  }
}

export async function updateCourseOffering(payload, user) {
  requireRemote();
  const userId = actorId(user);
  try {
    return await unwrap(
      supabase.from("cursos_seccion").update({
        nombre_visible: payload.displayName?.trim() || null,
        horas_semanales: payload.weeklyHours ? Number(payload.weeklyHours) : null,
        actualizado_por: userId,
      }).eq("id", payload.id).is("archivado_en", null).select("id").single(),
      "No se pudo actualizar el curso.",
    );
  } catch (error) {
    throw new Error(readableAcademicError(error, "No se pudo actualizar el curso."));
  }
}

export async function archiveCourseOffering(courseOfferingId, user) {
  requireRemote();
  actorId(user);
  try {
    return await unwrap(supabase.rpc("archivar_curso_seccion", {
      curso_seccion_id_solicitado: courseOfferingId,
    }), "No se pudo archivar el curso.");
  } catch (error) {
    throw new Error(readableAcademicError(error, "No se pudo archivar el curso."));
  }
}

export async function replaceTeachingAssignment(payload, user) {
  requireRemote();
  actorId(user);
  const scopeId = payload.courseOfferingId || payload.sectionId;
  if (!scopeId) throw new Error("Selecciona un curso o sección para asignar al docente.");

  try {
    return await unwrap(supabase.rpc("reemplazar_asignacion_docente", {
      curso_seccion_id_solicitado: payload.courseOfferingId || null,
      seccion_id_solicitada: payload.sectionId || null,
      docente_id_solicitado: payload.teacherId || null,
    }), "No se pudo guardar la asignación docente.");
  } catch (error) {
    throw new Error(readableAcademicError(error, "No se pudo guardar la asignación docente."));
  }
}

export async function enrollStudent(payload, user) {
  requireRemote();
  actorId(user);
  try {
    return await unwrap(supabase.rpc("matricular_estudiante_en_seccion", {
      anio_academico_id_solicitado: payload.academicYearId,
      seccion_id_solicitada: payload.sectionId,
      estudiante_id_solicitado: payload.studentId,
    }), "No se pudo matricular al estudiante.");
  } catch (error) {
    throw new Error(readableAcademicError(error, "No se pudo matricular al estudiante."));
  }
}

export async function withdrawStudent(enrollmentId, user) {
  requireRemote();
  actorId(user);
  try {
    return await unwrap(supabase.rpc("retirar_matricula", {
      matricula_id_solicitada: enrollmentId,
    }), "No se pudo retirar la matrícula.");
  } catch (error) {
    throw new Error(readableAcademicError(error, "No se pudo retirar la matrícula."));
  }
}

export function subscribeToAcademicChanges(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase.channel(`academic-management-${Date.now()}`);
  MANAGED_TABLES.forEach((table) => {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
  });
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
}
