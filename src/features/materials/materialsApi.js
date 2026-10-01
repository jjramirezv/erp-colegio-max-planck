import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { getCachedGeneralSettings } from "../general-settings/generalSettingsApi";

const STATUS_LABELS = { draft: "Borrador", published: "Publicado", archived: "Archivado" };
const ORIGIN_LABELS = { official: "Institucional", teacher_extra: "Docente" };
const DELIVERY_LABELS = { digital: "Digital", physical: "Físico", mixed: "Físico / Digital" };
const DELIVERY_VALUES = { Digital: "digital", "Físico": "physical", "Físico / Digital": "mixed" };
const ORIGIN_VALUES = { Institucional: "official", Docente: "teacher_extra" };

const MIME_TYPE_BY_EXTENSION = Object.freeze({
  pdf: "application/pdf",
  epub: "application/epub+zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
});

const TABLES = Object.freeze({
  years: "anios_academicos",
  levels: "niveles_educativos",
  grades: "grados",
  sections: "secciones",
  subjects: "asignaturas",
  courses: "cursos_seccion",
  assignments: "asignaciones_docentes",
  enrollments: "matriculas_estudiantes",
  materials: "materiales_educativos",
  versions: "versiones_material",
  releases: "publicaciones_material",
  targets: "destinatarios_material",
  distributions: "entregas_material_fisico",
  profiles: "perfiles",
});

const MATERIAL_SELECT = [
  "id",
  "title:titulo",
  "description:descripcion",
  "material_kind:tipo_material",
  "origin:origen",
  "subject_id:asignatura_id",
  "created_for_course_offering_id:curso_seccion_id",
  "created_for_section_id:seccion_id",
  "created_by:creado_por",
  "created_at:creado_en",
  "updated_at:actualizado_en",
  "archived_at:archivado_en",
].join(",");

const VERSION_SELECT = [
  "id",
  "material_id",
  "version_number:numero_version",
  "version_label:etiqueta_version",
  "storage_path:ruta_almacenamiento",
  "original_filename:nombre_archivo_original",
  "mime_type:tipo_mime",
  "byte_size:tamano_bytes",
  "change_notes:notas_cambio",
  "created_by:creado_por",
  "created_at:creado_en",
  "archived_at:archivado_en",
].join(",");

const RELEASE_SELECT = [
  "id",
  "material_id",
  "version_id",
  "status:estado",
  "available_from:disponible_desde",
  "available_until:disponible_hasta",
  "published_at:publicado_en",
  "published_by:publicado_por",
  "created_at:creado_en",
  "updated_at:actualizado_en",
  "archived_at:archivado_en",
].join(",");

const DISTRIBUTION_SELECT = [
  "id",
  "planned_quantity:cantidad_planificada",
  "delivered_quantity:cantidad_entregada",
  "status:estado",
  "delivered_on:fecha_entrega",
  "received_by:recibido_por",
  "updated_at:actualizado_en",
].join(",");

function limaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para trabajar con materiales reales.");
  }
}

function apiError(error, fallback) {
  if (!error) return new Error(fallback);
  if (error.code === "PGRST205" || error.code === "42P01") {
    return new Error("Aún falta ejecutar el esquema y la migración de materiales en Supabase.");
  }
  if (error.code === "42501") return new Error("Tu perfil no tiene permiso para realizar esta operación.");
  return new Error(error.message || fallback);
}

async function currentAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw apiError(error, "La sesión venció. Vuelve a ingresar al portal.");
  return data.user;
}

const READ_PAGE_SIZE = 500;

async function readTable(table, columns) {
  const rows = [];
  let lastId = null;

  for (;;) {
    let query = supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .limit(READ_PAGE_SIZE);

    if (lastId !== null) query = query.gt("id", lastId);
    const { data, error } = await query;
    if (error) throw apiError(error, `No se pudo consultar ${table}.`);
    if (!data?.length) return rows;

    rows.push(...data);
    const nextId = data.at(-1).id;
    if (String(nextId) === String(lastId)) {
      throw new Error(`La paginación de ${table} no avanzó.`);
    }
    lastId = nextId;
  }
}

function byId(rows) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function formatBytes(bytes) {
  if (!bytes) return "—";
  const megabytes = Number(bytes) / 1024 / 1024;
  return megabytes >= 0.1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(Number(bytes) / 1024))} KB`;
}

function fileType(mimeType, filename = "") {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.includes("word")) return "DOCX";
  if (mimeType?.includes("presentation") || mimeType?.includes("powerpoint")) return "PPTX";
  const extension = filename.split(".").pop()?.toUpperCase();
  return extension && extension.length <= 5 ? extension : "Archivo";
}

function safeFilename(filename) {
  const normalized = filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "material";
}

function releaseStatus(release, material) {
  if (material.archived_at || release?.archived_at) return "Archivado";
  return STATUS_LABELS[release?.status] || "Borrador";
}

function normalizeReleaseRow(release) {
  const row = Array.isArray(release) ? release[0] : release;
  if (!row) return null;
  return {
    id: row.id,
    material_id: row.material_id,
    version_id: row.version_id,
    status: row.estado,
    available_from: row.disponible_desde,
    available_until: row.disponible_hasta,
    published_at: row.publicado_en,
    published_by: row.publicado_por,
    created_at: row.creado_en,
    updated_at: row.actualizado_en,
    archived_at: row.archivado_en,
  };
}

function sortNewestReleases(releases) {
  return [...releases].sort((left, right) => {
    const byDate = String(right.created_at || "").localeCompare(String(left.created_at || ""));
    return byDate || String(right.id).localeCompare(String(left.id), undefined, { numeric: true });
  });
}

function selectWorkspaceRelease(material, releases) {
  const newest = sortNewestReleases(releases);
  if (material.archived_at) return newest.find((release) => release.status === "archived") || newest[0] || null;
  return newest.find((release) => release.status === "draft" && !release.archived_at)
    || newest.find((release) => release.status === "published" && !release.archived_at)
    || newest[0]
    || null;
}

function buildAcademicStructure({ levels, grades, sections, offerings, subjects, visibleSectionIds, classroomSectionIds }) {
  const subjectMap = byId(subjects);
  const offeringsBySection = new Map();
  offerings.forEach((offering) => {
    const key = String(offering.section_id);
    const values = offeringsBySection.get(key) || [];
    const subject = subjectMap.get(String(offering.subject_id));
    values.push({ id: String(offering.id), name: offering.display_name || subject?.name || "Curso", subjectId: String(offering.subject_id) });
    offeringsBySection.set(key, values);
  });

  return [...levels]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((level) => ({
      id: String(level.id),
      name: level.name,
      materialScope: level.material_scope || "course",
      grades: grades
        .filter((grade) => String(grade.level_id) === String(level.id))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((grade) => ({
          id: String(grade.id),
          name: grade.name,
          shortName: grade.name.split(" ")[0],
          sections: sections
            .filter((section) => String(section.grade_id) === String(grade.id) && visibleSectionIds.has(String(section.id)))
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
            .map((section) => {
              const sectionCourses = offeringsBySection.get(String(section.id)) || [];
              return {
                id: String(section.id),
                name: section.name,
                courses: [
                  ...sectionCourses.sort((a, b) => a.name.localeCompare(b.name, "es")),
                  ...(level.material_scope === "section" && classroomSectionIds.has(String(section.id))
                    ? [{ id: "section", name: "Materiales del aula", subjectId: null }] : []),
                ],
              };
            }),
        }))
        .filter((grade) => grade.sections.length),
    }))
    .filter((level) => level.grades.length);
}

function firstSelection(year, structure) {
  const level = structure[0];
  const grade = level?.grades?.[0];
  const section = grade?.sections?.[0];
  const course = section?.courses?.[0];
  return {
    year: String(year || new Date().getFullYear()),
    levelId: level?.id || "",
    gradeId: grade?.id || "",
    sectionId: section?.id || "",
    courseId: course?.id || "",
  };
}

function versionHistory(materialVersions, releases, profiles) {
  return [...materialVersions]
    .sort((a, b) => b.version_number - a.version_number)
    .map((version) => {
      const relatedRelease = releases.find((release) => String(release.version_id) === String(version.id));
      return {
        id: String(version.id),
        version: version.version_label || String(version.version_number),
        status: STATUS_LABELS[relatedRelease?.status] || (version.archived_at ? "Archivado" : "Borrador"),
        author: profiles.get(String(version.created_by))?.full_name || "Usuario del portal",
        date: version.created_at,
        summary: version.change_notes || "Versión registrada sin observaciones.",
        storagePath: version.storage_path,
      };
    });
}

export async function loadMaterialsWorkspace(portalUser) {
  requireSupabase();
  const [
    years, levels, grades, sections, subjects, offerings, assignments, enrollments,
    materials, versions, releases, targets, distributions, profiles,
  ] = await Promise.all([
    readTable(TABLES.years, "id,name:nombre,active:activo,starts_on:inicia_en,ends_on:termina_en"),
    readTable(TABLES.levels, "id,name:nombre,sort_order:orden,active:activo,material_scope:alcance_material"),
    readTable(TABLES.grades, "id,level_id:nivel_id,name:nombre,sort_order:orden"),
    readTable(TABLES.sections, "id,academic_year_id:anio_academico_id,grade_id:grado_id,name:nombre,active:activo"),
    readTable(TABLES.subjects, "id,code:codigo,name:nombre,active:activo,archived_at:archivado_en"),
    readTable(TABLES.courses, "id,academic_year_id:anio_academico_id,section_id:seccion_id,subject_id:asignatura_id,display_name:nombre_visible,active:activo,archived_at:archivado_en"),
    readTable(TABLES.assignments, "id,course_offering_id:curso_seccion_id,section_id:seccion_id,teacher_id:docente_id,starts_on:inicia_en,ends_on:termina_en,active:activo,archived_at:archivado_en"),
    readTable(TABLES.enrollments, "id,academic_year_id:anio_academico_id,section_id:seccion_id,student_id:estudiante_id,status:estado,enrolled_on:matriculado_en,withdrawn_on:retirado_en,archived_at:archivado_en"),
    readTable(TABLES.materials, MATERIAL_SELECT),
    readTable(TABLES.versions, VERSION_SELECT),
    readTable(TABLES.releases, RELEASE_SELECT),
    readTable(TABLES.targets, "id,release_id:publicacion_id,section_id:seccion_id,course_offering_id:curso_seccion_id"),
    readTable(TABLES.distributions, "id,material_id,release_id:publicacion_id,section_id:seccion_id,student_enrollment_id:matricula_id,planned_quantity:cantidad_planificada,delivered_quantity:cantidad_entregada,status:estado,delivered_on:fecha_entrega,received_by:recibido_por,updated_at:actualizado_en,archived_at:archivado_en"),
    readTable(TABLES.profiles, "id,full_name:nombre_completo,role:rol,active:activo"),
  ]);

  const activeYear = [...years]
    .sort((a, b) => String(b.starts_on || "").localeCompare(String(a.starts_on || "")))
    .find((year) => year.active) || years[0];
  const activeSections = sections.filter((section) => String(section.academic_year_id) === String(activeYear?.id) && section.active);
  const activeOfferings = offerings.filter((offering) => String(offering.academic_year_id) === String(activeYear?.id) && offering.active && !offering.archived_at);
  const allowedCourseIds = new Set(activeOfferings.map((offering) => String(offering.id)));
  let visibleSectionIds = new Set(activeSections.map((section) => String(section.id)));
  let classroomSectionIds = new Set(visibleSectionIds);

  if (portalUser.role === "docente") {
    const today = limaDate();
    const currentAssignments = assignments.filter((item) => item.active
      && !item.archived_at
      && String(item.teacher_id) === String(portalUser.id)
      && (!item.starts_on || item.starts_on <= today)
      && (!item.ends_on || item.ends_on >= today));
    const teacherCourseIds = new Set(currentAssignments.filter((item) => item.course_offering_id).map((item) => String(item.course_offering_id)));
    const directlyAssignedSectionIds = new Set(currentAssignments.filter((item) => item.section_id).map((item) => String(item.section_id)));
    classroomSectionIds = directlyAssignedSectionIds;
    activeOfferings.forEach((offering) => { if (!teacherCourseIds.has(String(offering.id))) allowedCourseIds.delete(String(offering.id)); });
    visibleSectionIds = new Set([
      ...directlyAssignedSectionIds,
      ...activeOfferings.filter((offering) => allowedCourseIds.has(String(offering.id))).map((offering) => String(offering.section_id)),
    ]);
  } else if (portalUser.role === "estudiante") {
    visibleSectionIds = new Set(enrollments.filter((item) => item.status === "active" && !item.archived_at && String(item.student_id) === String(portalUser.id)).map((item) => String(item.section_id)));
    activeOfferings.forEach((offering) => { if (!visibleSectionIds.has(String(offering.section_id))) allowedCourseIds.delete(String(offering.id)); });
  }

  const visibleOfferings = activeOfferings.filter((offering) => allowedCourseIds.has(String(offering.id)));
  const structure = buildAcademicStructure({ levels: levels.filter((level) => level.active), grades, sections: activeSections, offerings: visibleOfferings, subjects: subjects.filter((subject) => subject.active && !subject.archived_at), visibleSectionIds, classroomSectionIds });
  const sectionMap = byId(activeSections);
  const gradeMap = byId(grades);
  const levelMap = byId(levels);
  const offeringMap = byId(visibleOfferings);
  const subjectMap = byId(subjects);
  const profileMap = byId(profiles);
  const versionsByMaterial = new Map();
  versions.forEach((version) => {
    const key = String(version.material_id);
    versionsByMaterial.set(key, [...(versionsByMaterial.get(key) || []), version]);
  });
  const releasesByMaterial = new Map();
  releases.forEach((release) => {
    const key = String(release.material_id);
    releasesByMaterial.set(key, [...(releasesByMaterial.get(key) || []), release]);
  });
  const targetsByRelease = new Map();
  targets.forEach((target) => {
    const key = String(target.release_id);
    targetsByRelease.set(key, [...(targetsByRelease.get(key) || []), target]);
  });
  const sectionDistributionByRelease = new Map();
  distributions.forEach((distribution) => {
    if (distribution.student_enrollment_id !== null || distribution.archived_at) return;
    const key = `${distribution.material_id}:${distribution.release_id}:${distribution.section_id}`;
    const current = sectionDistributionByRelease.get(key);
    if (!current || String(distribution.updated_at || "") > String(current.updated_at || "")) {
      sectionDistributionByRelease.set(key, distribution);
    }
  });

  const materialRows = [];
  materials.forEach((material) => {
    const materialReleases = releasesByMaterial.get(String(material.id)) || [];
    const materialVersions = versionsByMaterial.get(String(material.id)) || [];
    const release = selectWorkspaceRelease(material, materialReleases);
    if (!release) return;
    const hasPublishedRelease = materialReleases.some((item) => Boolean(item.published_at));
    const latestPublishedRelease = sortNewestReleases(materialReleases).find((item) => item.published_at);
      const releaseTargets = targetsByRelease.get(String(release.id)) || [];
      const version = release.version_id
        ? materialVersions.find((item) => String(item.id) === String(release.version_id)) || null
        : null;
      releaseTargets.forEach((target) => {
        const section = sectionMap.get(String(target.section_id));
        if (!section || !visibleSectionIds.has(String(section.id))) return;
        const grade = gradeMap.get(String(section.grade_id));
        const level = levelMap.get(String(grade?.level_id));
        const offering = target.course_offering_id ? offeringMap.get(String(target.course_offering_id)) : null;
        const subject = offering ? subjectMap.get(String(offering.subject_id)) : subjectMap.get(String(material.subject_id));
        const physical = sectionDistributionByRelease.get(`${material.id}:${release.id}:${section.id}`);
        const isTeacherOwner = portalUser.role === "docente" && material.origin === "teacher_extra" && String(material.created_by) === String(portalUser.id);
        materialRows.push({
          id: `${material.id}:${release.id}:${target.id}`,
          title: material.title,
          description: material.description || "",
          year: String(activeYear?.name || new Date().getFullYear()),
          levelId: String(level?.id || ""),
          level: level?.name || "",
          gradeId: String(grade?.id || ""),
          grade: grade?.name || "",
          sectionId: String(section.id),
          section: section.name,
          courseId: offering ? String(offering.id) : "section",
          course: offering?.display_name || subject?.name || "Materiales del aula",
          origin: ORIGIN_LABELS[material.origin] || material.origin,
          delivery: DELIVERY_LABELS[material.material_kind] || material.material_kind,
          fileType: version ? fileType(version.mime_type, version.original_filename) : "Ficha",
          fileSize: version ? formatBytes(version.byte_size) : "—",
          version: version?.version_label || (version ? String(version.version_number) : "—"),
          status: releaseStatus(release, material),
          updatedAt: release.updated_at || material.updated_at,
          publishedAt: release.published_at || latestPublishedRelease?.published_at || null,
          createdBy: profileMap.get(String(material.created_by))?.full_name || "Usuario del portal",
          versions: versionHistory(materialVersions, materialReleases, profileMap),
          permissions: { canEdit: isTeacherOwner, canArchive: isTeacherOwner, canPublish: isTeacherOwner, canUploadVersion: isTeacherOwner },
          physicalDistribution: physical ? {
            id: physical.id,
            planned: physical.planned_quantity,
            delivered: physical.delivered_quantity,
            status: physical.status,
            section: section.name,
            recipient: physical.received_by || null,
            deliveredAt: physical.delivered_on,
            updatedAt: physical.updated_at,
          } : null,
          db: {
            materialId: material.id,
            releaseId: release.id,
            targetId: target.id,
            versionId: version?.id || null,
            storagePath: version?.storage_path || null,
            courseOfferingId: offering?.id || null,
            sectionId: section.id,
            subjectId: subject?.id || material.subject_id || null,
            releaseStatus: release.status,
            materialKind: material.material_kind,
            hasPublishedRelease,
          },
        });
      });
  });

  return {
    years: activeYear ? [String(activeYear.name)] : [],
    defaultSelection: { ...firstSelection(activeYear?.name, structure), ...(portalUser.role === "docente" ? { courseId: "" } : {}) },
    academicStructure: structure,
    materials: materialRows,
    permissions: {
      canCreate: portalUser.role !== "docente" || structure.some((level) => level.grades.some((grade) => grade.sections.some((section) => section.courses.length))),
    },
  };
}

async function resolveCourse(courseId) {
  if (!courseId || courseId === "section") return null;
  const { data, error } = await supabase
    .from(TABLES.courses)
    .select("id,subject_id:asignatura_id,section_id:seccion_id")
    .eq("id", courseId)
    .single();
  if (error) throw apiError(error, "No se pudo validar el curso seleccionado.");
  return data;
}

async function uploadFile(file, user, materialId, portalRole) {
  if (!file) return null;
  if (file.size <= 0) throw new Error("El archivo seleccionado está vacío.");
  const maxFileSizeMb = getCachedGeneralSettings().maxFileSizeMb;
  if (file.size > maxFileSizeMb * 1024 * 1024) throw new Error(`El archivo supera el límite de ${maxFileSizeMb} MB.`);
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = MIME_TYPE_BY_EXTENSION[extension];
  if (!mimeType) throw new Error("Usa un archivo PDF, Office, EPUB o una imagen compatible.");
  const ownerFolder = portalRole === "docente" ? "teachers" : "managed";
  const storagePath = `${ownerFolder}/${user.id}/${materialId}/${Date.now()}-${safeFilename(file.name)}`;
  const { error } = await supabase.storage.from("school-materials").upload(storagePath, file, { contentType: mimeType, upsert: false });
  if (error) throw apiError(error, "No se pudo subir el archivo.");
  return { storagePath, filename: file.name, mimeType, byteSize: file.size };
}

async function insertVersion({ materialId, file, versionLabel, changeNotes, user, portalRole }) {
  const { data: existing, error: versionsError } = await supabase
    .from(TABLES.versions)
    .select("version_number:numero_version")
    .eq("material_id", materialId)
    .order("numero_version", { ascending: false })
    .limit(1);
  if (versionsError) throw apiError(versionsError, "No se pudo calcular la siguiente versión.");
  const nextNumber = (existing?.[0]?.version_number || 0) + 1;
  const normalizedLabel = String(versionLabel || `${nextNumber}.0`).trim();
  if (!/^[0-9]+([.][0-9]+){0,2}$/.test(normalizedLabel)) {
    throw new Error("La versión debe usar el formato 1, 1.2 o 1.2.3.");
  }
  const uploaded = await uploadFile(file, user, materialId, portalRole);
  if (!uploaded) return null;
  const { data, error } = await supabase.from(TABLES.versions).insert({
    material_id: materialId,
    numero_version: nextNumber,
    etiqueta_version: normalizedLabel,
    ruta_almacenamiento: uploaded.storagePath,
    nombre_archivo_original: uploaded.filename,
    tipo_mime: uploaded.mimeType,
    tamano_bytes: uploaded.byteSize,
    notas_cambio: changeNotes || "Versión inicial",
    creado_por: user.id,
  }).select(VERSION_SELECT).single();
  if (error) throw apiError(error, "El archivo se cargó, pero no se pudo registrar su versión.");
  return data;
}

export async function createMaterial(payload, portalUser) {
  requireSupabase();
  if (!payload.courseId || !payload.sectionId) throw new Error("Selecciona el curso y la sección antes de subir el material.");
  const user = await currentAuthUser();
  const course = await resolveCourse(payload.courseId);
  if (course && String(course.section_id) !== String(payload.sectionId)) throw new Error("El curso no pertenece a la sección seleccionada.");
  const materialKind = DELIVERY_VALUES[payload.delivery] || "digital";
  const origin = portalUser.role === "docente" ? "teacher_extra" : (ORIGIN_VALUES[payload.origin] || "official");
  const { data: material, error: materialError } = await supabase.from(TABLES.materials).insert({
    titulo: payload.title.trim(),
    descripcion: payload.description?.trim() || null,
    tipo_material: materialKind,
    origen: origin,
    asignatura_id: course?.subject_id || null,
    curso_seccion_id: course?.id || null,
    seccion_id: course ? null : payload.sectionId,
    creado_por: user.id,
    actualizado_por: user.id,
  }).select(MATERIAL_SELECT).single();
  if (materialError) throw apiError(materialError, "No se pudo crear el material.");

  try {
    const version = payload.file ? await insertVersion({ materialId: material.id, file: payload.file, versionLabel: "1.0", changeNotes: "Versión inicial", user, portalRole: portalUser.role }) : null;
    const { data: release, error: releaseError } = await supabase.from(TABLES.releases).insert({
      material_id: material.id,
      version_id: version?.id || null,
      estado: "draft",
      creado_por: user.id,
    }).select(RELEASE_SELECT).single();
    if (releaseError) throw apiError(releaseError, "No se pudo crear la publicación inicial.");
    const { error: targetError } = await supabase.from(TABLES.targets).insert({
      publicacion_id: release.id,
      seccion_id: payload.sectionId,
      curso_seccion_id: course?.id || null,
      creado_por: user.id,
    });
    if (targetError) throw apiError(targetError, "No se pudo asignar el material al salón seleccionado.");
    if (payload.status === "Publicado") await publishMaterial({ material: { db: { releaseId: release.id } } });
    return { material, version, release };
  } catch (error) {
    await supabase.rpc("archivar_material", { material_id_solicitado: material.id });
    throw error;
  }
}

export async function updateMaterial({ changes, material }, portalUser) {
  requireSupabase();
  const releaseIsDraft = material.db?.releaseStatus === "draft";
  const requestedKind = DELIVERY_VALUES[changes.delivery] || "digital";
  const currentKind = DELIVERY_VALUES[material.delivery] || material.db?.materialKind || "digital";
  const scopeChanged = ["levelId", "gradeId", "sectionId", "courseId"]
    .some((field) => String(changes[field] || "") !== String(material[field] || ""));
  if ((!releaseIsDraft || material.db?.hasPublishedRelease) && (scopeChanged || requestedKind !== currentKind)) {
    throw new Error("El alcance, el curso, el salón y el tipo de entrega no pueden cambiarse después de publicar. Crea otro material para un destino distinto.");
  }
  const materialId = material.db?.materialId;
  const course = await resolveCourse(changes.courseId);
  const { error } = await supabase.rpc("actualizar_metadatos_material", {
    material_id_solicitado: materialId,
    publicacion_id_solicitada: material.db?.releaseId,
    destinatario_id_solicitado: material.db?.targetId,
    titulo_solicitado: changes.title.trim(),
    descripcion_solicitada: changes.description?.trim() || "",
    tipo_material_solicitado: requestedKind,
    origen_solicitado: portalUser.role === "docente" ? "teacher_extra" : (ORIGIN_VALUES[changes.origin] || "official"),
    asignatura_id_solicitada: course?.subject_id || null,
    curso_seccion_id_solicitado: course?.id || null,
    seccion_id_solicitada: changes.sectionId,
  });
  if (error) throw apiError(error, "No se pudo actualizar el material.");
  if (requestedKind !== "physical" && changes.file) await uploadMaterialVersion({ materialId, material, file: changes.file, version: undefined, summary: "Archivo reemplazado desde la edición" }, portalUser);
  if (changes.status === "Publicado" && material.status !== "Publicado") await publishMaterial({ material });
  if (changes.status === "Archivado" && material.status !== "Archivado") await archiveMaterial({ material });
}

export async function uploadMaterialVersion(payload, portalUser) {
  requireSupabase();
  const user = await currentAuthUser();
  const materialId = payload.material.db?.materialId || payload.materialId;
  const currentReleaseId = payload.material.db?.releaseId;
  const version = await insertVersion({ materialId, file: payload.file, versionLabel: payload.version, changeNotes: payload.summary, user, portalRole: portalUser?.role });
  if (!version) throw new Error("Selecciona un archivo para registrar la nueva versión.");
  const { data: release, error: releaseError } = await supabase.rpc("crear_o_reutilizar_borrador_material", {
    material_id_solicitado: materialId,
    publicacion_origen_id_solicitada: currentReleaseId,
    version_id_solicitada: version.id,
  });
  if (releaseError) throw apiError(releaseError, "El archivo se registró, pero no se pudo preparar su borrador.");
  return { version, release: normalizeReleaseRow(release) };
}

export async function publishMaterial({ material }) {
  requireSupabase();
  const { error } = await supabase.rpc("publicar_material", { publicacion_id_solicitada: material.db?.releaseId });
  if (error) throw apiError(error, "No se pudo publicar el material.");
}

export async function archiveMaterial({ material }) {
  requireSupabase();
  const { error } = await supabase.rpc("archivar_material", { material_id_solicitado: material.db?.materialId });
  if (error) throw apiError(error, "No se pudo archivar el material.");
}

export async function savePhysicalDistribution({ material, plannedQuantity, deliveredQuantity, recipient }) {
  requireSupabase();
  const user = await currentAuthUser();
  const materialId = material?.db?.materialId;
  const releaseId = material?.db?.releaseId;
  const sectionId = material?.db?.sectionId;
  const planned = Number(plannedQuantity);
  const delivered = Number(deliveredQuantity);

  if (!materialId || !releaseId || !sectionId) {
    throw new Error("No se pudo identificar el material, la publicación o el salón seleccionado.");
  }
  if (!Number.isInteger(planned) || planned <= 0) {
    throw new Error("La cantidad planificada debe ser un número entero mayor que cero.");
  }
  if (!Number.isInteger(delivered) || delivered < 0 || delivered > planned) {
    throw new Error("La cantidad entregada debe estar entre cero y la cantidad planificada.");
  }

  const status = delivered === 0 ? "pending" : delivered === planned ? "delivered" : "partial";
  const receivedBy = String(recipient || "").trim() || null;
  const { data: existing, error: lookupError } = await supabase
    .from(TABLES.distributions)
    .select("id")
    .eq("material_id", materialId)
    .eq("publicacion_id", releaseId)
    .eq("seccion_id", sectionId)
    .is("matricula_id", null)
    .is("archivado_en", null)
    .order("actualizado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw apiError(lookupError, "No se pudo consultar el reparto de este salón.");

  const values = {
    cantidad_planificada: planned,
    cantidad_entregada: delivered,
    estado: status,
    recibido_por: receivedBy,
    actualizado_por: user.id,
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from(TABLES.distributions)
      .update(values)
      .eq("id", existing.id)
      .select(DISTRIBUTION_SELECT)
      .single();
    if (error) throw apiError(error, "No se pudo actualizar el reparto del salón.");
    return { distribution: data };
  }

  const { data, error } = await supabase
    .from(TABLES.distributions)
    .insert({
      material_id: materialId,
      publicacion_id: releaseId,
      seccion_id: sectionId,
      matricula_id: null,
      creado_por: user.id,
      ...values,
    })
    .select(DISTRIBUTION_SELECT)
    .single();
  if (error) throw apiError(error, "No se pudo registrar el reparto del salón.");
  return { distribution: data };
}

export async function createMaterialSignedUrl(material, expiresIn = 600) {
  requireSupabase();
  const storagePath = material.db?.storagePath;
  if (!storagePath) throw new Error("Este material no tiene un archivo digital asociado.");
  const { data, error } = await supabase.storage.from("school-materials").createSignedUrl(storagePath, expiresIn);
  if (error) throw apiError(error, "No se pudo abrir el archivo.");
  return data.signedUrl;
}

export function subscribeToMaterialChanges(onChange) {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const channel = supabase
    .channel("school-materials-workspace")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.years }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.levels }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.grades }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.sections }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.profiles }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.subjects }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.courses }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.assignments }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.enrollments }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.materials }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.versions }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.releases }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.targets }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: TABLES.distributions }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
