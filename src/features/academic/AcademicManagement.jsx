import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import {
  archiveCourseOffering,
  createCourseOffering,
  enrollStudent,
  loadAcademicWorkspace,
  replaceTeachingAssignment,
  subscribeToAcademicChanges,
  updateCourseOffering,
  withdrawStudent,
} from "./academicApi";
import { EMPTY_WORKSPACE, SELECT_CLASS, TABS } from "./constants";
import { createLocalWorkspace } from "./data/workspace";
import { idEquals, localDate, normalizeTab } from "./utils";
import StatusMessage from "./components/StatusMessage";
import EmptyState from "./components/EmptyState";
import CourseDialog from "./components/CourseDialog";
import CoursesPanel from "./components/CoursesPanel";
import EnrollmentsPanel from "./components/EnrollmentsPanel";
import AuditPanel from "./components/AuditPanel";

export default function AcademicManagement({ user, initialTab = "cursos" }) {
  const remote = isSupabaseConfigured && user?.authSource === "supabase";
  const authorized = ["direccion", "coordinador_academico"].includes(user?.role);
  const [workspace, setWorkspace] = useState(() => remote ? EMPTY_WORKSPACE : createLocalWorkspace());
  const [loading, setLoading] = useState(remote);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(null);
  const [tab, setTab] = useState(() => normalizeTab(initialTab));
  const [yearId, setYearId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [teacherChoices, setTeacherChoices] = useState({});
  const [studentChoice, setStudentChoice] = useState("");
  const [courseDialog, setCourseDialog] = useState(null);
  const [busyKey, setBusyKey] = useState("");
  const refreshTimer = useRef(null);
  const activeTabRef = useRef(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!remote || !authorized) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const result = await loadAcademicWorkspace();
      setWorkspace(result);
      if (!quiet) setMessage(null);
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudo cargar la gestión académica." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authorized, remote]);

  useEffect(() => { setTab(normalizeTab(initialTab)); }, [initialTab]);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [tab]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!remote || !authorized) return undefined;
    return subscribeToAcademicChanges(() => {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => refresh({ quiet: true }), 250);
    });
  }, [authorized, refresh, remote]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const orderedYears = useMemo(() => [...workspace.years].sort((a, b) => String(b.startsOn || b.name).localeCompare(String(a.startsOn || a.name))), [workspace.years]);
  const orderedLevels = useMemo(() => [...workspace.levels].sort((a, b) => a.sortOrder - b.sortOrder), [workspace.levels]);
  const grades = useMemo(() => workspace.grades.filter((item) => idEquals(item.levelId, levelId)).sort((a, b) => a.sortOrder - b.sortOrder), [levelId, workspace.grades]);
  const sections = useMemo(() => workspace.sections.filter((item) => idEquals(item.academicYearId, yearId) && idEquals(item.gradeId, gradeId) && item.active), [gradeId, workspace.sections, yearId]);

  useEffect(() => {
    if (!orderedYears.length) return setYearId("");
    if (orderedYears.some((item) => idEquals(item.id, yearId))) return;
    const newestActive = orderedYears.find((item) => item.active);
    setYearId(String((newestActive || orderedYears[0]).id));
  }, [orderedYears, yearId]);
  useEffect(() => {
    if (!orderedLevels.length) return setLevelId("");
    if (orderedLevels.some((item) => idEquals(item.id, levelId))) return;
    setLevelId(String(orderedLevels[0].id));
  }, [levelId, orderedLevels]);
  useEffect(() => {
    if (!grades.length) return setGradeId("");
    if (grades.some((item) => idEquals(item.id, gradeId))) return;
    setGradeId(String(grades[0].id));
  }, [gradeId, grades]);
  useEffect(() => {
    if (!sections.length) return setSectionId("");
    if (sections.some((item) => idEquals(item.id, sectionId))) return;
    setSectionId(String(sections[0].id));
  }, [sectionId, sections]);

  const selectedYear = orderedYears.find((item) => idEquals(item.id, yearId));
  const selectedLevel = orderedLevels.find((item) => idEquals(item.id, levelId));
  const selectedGrade = grades.find((item) => idEquals(item.id, gradeId));
  const selectedSection = sections.find((item) => idEquals(item.id, sectionId));
  const teachers = useMemo(() => workspace.profiles.filter((item) => item.role === "docente" && item.active).sort((a, b) => a.fullName.localeCompare(b.fullName)), [workspace.profiles]);
  const students = useMemo(() => workspace.profiles.filter((item) => item.role === "estudiante" && item.active).sort((a, b) => a.fullName.localeCompare(b.fullName)), [workspace.profiles]);
  const visibleOfferings = useMemo(() => workspace.offerings.filter((item) => idEquals(item.sectionId, sectionId) && item.active && !item.archivedAt), [sectionId, workspace.offerings]);
  const archivedOfferings = useMemo(() => workspace.offerings.filter((item) => idEquals(item.sectionId, sectionId) && (!item.active || item.archivedAt)), [sectionId, workspace.offerings]);
  const visibleEnrollments = useMemo(() => workspace.enrollments.filter((item) => idEquals(item.sectionId, sectionId) && item.status === "active" && !item.archivedAt), [sectionId, workspace.enrollments]);
  const enrollmentHistory = useMemo(() => workspace.enrollments.filter((item) => idEquals(item.sectionId, sectionId) && (item.status !== "active" || item.archivedAt)), [sectionId, workspace.enrollments]);
  const eligibleStudents = useMemo(() => {
    const enrolledInYear = new Set(workspace.enrollments.filter((item) => idEquals(item.academicYearId, yearId) && item.status === "active" && !item.archivedAt).map((item) => String(item.studentId)));
    return students.filter((student) => !enrolledInYear.has(String(student.id)));
  }, [students, workspace.enrollments, yearId]);

  const subjectById = useMemo(() => new Map(workspace.subjects.map((item) => [String(item.id), item])), [workspace.subjects]);
  const profileById = useMemo(() => new Map(workspace.profiles.map((item) => [String(item.id), item])), [workspace.profiles]);
  const assignmentFor = useCallback((scope, id) => workspace.assignments.find((item) => item.active && !item.archivedAt && idEquals(item[scope], id)), [workspace.assignments]);

  useEffect(() => {
    const choices = {};
    if (sectionId) choices[`section:${sectionId}`] = assignmentFor("sectionId", sectionId)?.teacherId || "";
    visibleOfferings.forEach((offering) => { choices[`course:${offering.id}`] = assignmentFor("courseOfferingId", offering.id)?.teacherId || ""; });
    setTeacherChoices((current) => ({ ...current, ...choices }));
  }, [assignmentFor, sectionId, visibleOfferings]);
  useEffect(() => {
    if (!eligibleStudents.some((item) => idEquals(item.id, studentChoice))) setStudentChoice("");
  }, [eligibleStudents, studentChoice]);

  function addLocalAudit(current, action, entityType, entityId, details) {
    return [{
      id: `local-audit-${Date.now()}-${Math.random()}`,
      actorId: user?.id || "local-user",
      actorName: user?.name || user?.fullName || "Usuario local",
      actorRole: user?.role || "coordinador_academico",
      action,
      entityType,
      entityId,
      details,
      createdAt: new Date().toISOString(),
    }, ...current];
  }

  async function runOperation(key, operation, successText) {
    setBusyKey(key);
    setMessage(null);
    try {
      await operation();
      if (remote) await refresh({ quiet: true });
      setMessage({ type: "success", text: successText });
      return true;
    } catch (error) {
      setMessage({ type: "error", text: error.message || "No se pudo completar la operación." });
      return false;
    } finally {
      setBusyKey("");
    }
  }

  async function saveCourse(form) {
    if (form.mode !== "edit" && (!form.code.trim() || !form.subjectName.trim())) {
      setMessage({ type: "error", text: "Completa el código y la asignatura con texto válido." });
      return;
    }
    const payload = { ...form, academicYearId: selectedYear?.id, sectionId: selectedSection?.id };
    const success = await runOperation(`course-${form.mode}`, async () => {
      if (remote) {
        if (form.mode === "edit") await updateCourseOffering(payload, user);
        else await createCourseOffering(payload, user);
        return;
      }
      if (form.mode !== "edit") {
        const code = form.code.trim().toUpperCase();
        const existingSubject = workspace.subjects.find((item) => item.code.toUpperCase() === code && !item.archivedAt);
        if (existingSubject && workspace.offerings.some((item) => idEquals(item.sectionId, selectedSection.id) && idEquals(item.subjectId, existingSubject.id) && !item.archivedAt)) {
          throw new Error("Ese curso ya está configurado en la sección.");
        }
      }
      setWorkspace((current) => {
        if (form.mode === "edit") {
          return {
            ...current,
            offerings: current.offerings.map((item) => idEquals(item.id, form.id) ? { ...item, displayName: form.displayName.trim() || null, weeklyHours: form.weeklyHours ? Number(form.weeklyHours) : null } : item),
            audit: addLocalAudit(current.audit, "updated", "course_offerings", form.id, { display_name: form.displayName || null, weekly_hours: form.weeklyHours || null }),
          };
        }
        const code = form.code.trim().toUpperCase();
        let subject = current.subjects.find((item) => item.code.toUpperCase() === code && !item.archivedAt);
        const subjects = [...current.subjects];
        if (!subject) {
          subject = { id: `local-subject-${Date.now()}`, code, name: form.subjectName.trim(), active: true, archivedAt: null };
          subjects.push(subject);
        }
        const id = `local-offering-${Date.now()}`;
        const offering = { id, academicYearId: selectedYear.id, sectionId: selectedSection.id, subjectId: subject.id, displayName: form.displayName.trim() || null, weeklyHours: form.weeklyHours ? Number(form.weeklyHours) : null, active: true, archivedAt: null };
        return { ...current, subjects, offerings: [...current.offerings, offering], audit: addLocalAudit(current.audit, "created", "course_offerings", id, { subject: subject.name, section: selectedSection.name }) };
      });
    }, form.mode === "edit" ? "Curso actualizado." : "Curso creado para la sección.");
    if (success) setCourseDialog(null);
  }

  async function archiveOffering(offering) {
    const subject = subjectById.get(String(offering.subjectId));
    if (!window.confirm(`¿Archivar ${offering.displayName || subject?.name || "este curso"}? Solo continuará si no tiene materiales ni publicaciones activas.`)) return;
    await runOperation(`archive-${offering.id}`, async () => {
      if (remote) return archiveCourseOffering(offering.id, user);
      setWorkspace((current) => ({
        ...current,
        offerings: current.offerings.map((item) => idEquals(item.id, offering.id) ? { ...item, active: false, archivedAt: new Date().toISOString() } : item),
        assignments: current.assignments.map((item) => idEquals(item.courseOfferingId, offering.id) ? { ...item, active: false, archivedAt: new Date().toISOString() } : item),
        audit: addLocalAudit(current.audit, "archived", "course_offerings", offering.id, { subject: subject?.name }),
      }));
    }, "Curso archivado sin eliminar su historial.");
  }

  async function saveTeacher(scope, id) {
    const key = `${scope}:${id}`;
    const teacherId = teacherChoices[key] || "";
    await runOperation(`teacher-${key}`, async () => {
      const payload = scope === "course" ? { courseOfferingId: id, teacherId: teacherId || null } : { sectionId: id, teacherId: teacherId || null };
      if (remote) return replaceTeachingAssignment(payload, user);
      setWorkspace((current) => {
        const scopeField = scope === "course" ? "courseOfferingId" : "sectionId";
        const existing = current.assignments.find((item) => item.active && !item.archivedAt && idEquals(item[scopeField], id));
        let assignments;
        if (!teacherId) assignments = current.assignments.map((item) => item.active && !item.archivedAt && idEquals(item[scopeField], id) ? { ...item, active: false, archivedAt: new Date().toISOString() } : item);
        else if (existing) assignments = current.assignments.map((item) => idEquals(item.id, existing.id) ? { ...item, teacherId } : item);
        else assignments = [...current.assignments, { id: `local-assignment-${Date.now()}`, courseOfferingId: scope === "course" ? id : null, sectionId: scope === "section" ? id : null, teacherId, assignmentRole: "titular", startsOn: localDate(), active: true, archivedAt: null }];
        return { ...current, assignments, audit: addLocalAudit(current.audit, "updated", "teaching_assignments", existing?.id || id, { teacher: profileById.get(String(teacherId))?.fullName || "Sin docente" }) };
      });
    }, teacherId ? "Docente asignado correctamente." : "La sección quedó sin docente asignado.");
  }

  async function addEnrollment() {
    if (!studentChoice) return setMessage({ type: "error", text: "Selecciona un estudiante para matricular." });
    if (selectedSection?.capacity && visibleEnrollments.length >= selectedSection.capacity) {
      return setMessage({ type: "error", text: `La sección alcanzó su capacidad máxima de ${selectedSection.capacity} estudiantes.` });
    }
    const student = profileById.get(String(studentChoice));
    const success = await runOperation("enroll", async () => {
      if (remote) return enrollStudent({ academicYearId: selectedYear.id, sectionId: selectedSection.id, studentId: studentChoice }, user);
      const id = `local-enrollment-${Date.now()}`;
      setWorkspace((current) => ({
        ...current,
        enrollments: [...current.enrollments, { id, academicYearId: selectedYear.id, sectionId: selectedSection.id, studentId: studentChoice, status: "active", enrolledOn: localDate(), withdrawnOn: null, archivedAt: null }],
        audit: addLocalAudit(current.audit, "created", "student_enrollments", id, { student: student?.fullName, section: selectedSection.name }),
      }));
    }, `${student?.fullName || "Estudiante"} fue matriculado.`);
    if (success) setStudentChoice("");
  }

  async function removeEnrollment(enrollment) {
    const student = profileById.get(String(enrollment.studentId));
    if (!window.confirm(`¿Retirar la matrícula activa de ${student?.fullName || "este estudiante"}? El historial se conservará.`)) return;
    await runOperation(`withdraw-${enrollment.id}`, async () => {
      if (remote) return withdrawStudent(enrollment.id, user);
      setWorkspace((current) => ({
        ...current,
        enrollments: current.enrollments.map((item) => idEquals(item.id, enrollment.id) ? { ...item, status: "withdrawn", withdrawnOn: localDate() } : item),
        audit: addLocalAudit(current.audit, "updated", "student_enrollments", enrollment.id, { status: "withdrawn", student: student?.fullName }),
      }));
    }, "Matrícula retirada; el historial permanece disponible.");
  }

  if (!authorized) {
    return (
      <section className="grid min-h-[420px] place-content-center justify-items-center gap-2 text-center text-[#5c6e67]">
        <ShieldCheck className="h-[38px] w-[38px] text-brand-900" />
        <h1 className="m-0 font-sans text-2xl font-extrabold text-ink">Acceso restringido</h1>
        <p className="m-0 max-w-[420px] text-[11px] leading-relaxed">Gestión académica está disponible únicamente para Dirección y Coordinación Académica.</p>
      </section>
    );
  }

  const sectionTeacher = assignmentFor("sectionId", sectionId);
  const sectionTeacherKey = `section:${sectionId}`;

  return (
    <section className="mx-auto max-w-[1360px] text-ink">
      <header className="mb-[18px] flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div>
          <span className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.15em] text-brand-800">
            <GraduationCap className="h-4 w-4" /> OPERACIÓN ACADÉMICA
          </span>
          <h1 className="mb-1.5 mt-1 text-3xl font-extrabold tracking-[-0.045em] text-[#14231e] sm:text-4xl">Gestión académica</h1>
          <p className="m-0 text-[13px] leading-relaxed text-muted">Configura cursos, responsables y matrículas sin mezclar credenciales ni materiales.</p>
        </div>
        <div className="flex items-center justify-between gap-2 md:justify-start">
          <span className="hidden min-h-[38px] items-center gap-1.5 border border-[#9cb8ae] bg-surface px-3 text-[10px] font-extrabold text-brand-900 min-[521px]:flex">
            <ShieldCheck className="h-[15px] w-[15px]" />{user.role === "direccion" ? "Dirección" : "Coordinación"}
          </span>
          <button
            type="button"
            onClick={() => refresh({ quiet: true })}
            disabled={!remote || refreshing}
            title={remote ? "Actualizar datos" : "Disponible con Supabase"}
            className="flex min-h-[38px] items-center gap-1.5 border border-[#9cb8ae] bg-surface px-3 text-[10px] font-extrabold text-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-[15px] w-[15px] ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} /><span>Actualizar</span>
          </button>
        </div>
      </header>

      {!remote ? (
        <div className="mb-3 flex items-start gap-2 border border-amber-300 bg-amber-soft px-3 py-2.5 text-[11px] leading-relaxed text-amber-ink">
          <AlertCircle className="mt-0.5 h-[17px] w-[17px] shrink-0" />
          <span><strong>Vista local de desarrollo.</strong> Puedes probar el flujo; los cambios de esta sesión no se sincronizan con otras cuentas.</span>
        </div>
      ) : null}
      <StatusMessage message={message} onClose={() => setMessage(null)} />

      <div
        className="grid grid-cols-2 divide-x divide-y divide-line border border-[#9eb7ae] bg-surface sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-[repeat(4,minmax(130px,1fr))_minmax(210px,1.35fr)]"
        aria-label="Contexto académico"
      >
        <label className="min-w-0 grid gap-1.5 p-3">
          <span className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wide text-muted"><CalendarDays className="h-[13px] w-[13px]" /> Año</span>
          <select value={yearId} onChange={(event) => setYearId(event.target.value)} disabled={!orderedYears.length} className={SELECT_CLASS}>
            {orderedYears.map((item) => <option value={item.id} key={item.id}>{item.name}{item.active ? " · Activo" : ""}</option>)}
          </select>
        </label>
        <label className="min-w-0 grid gap-1.5 p-3">
          <span className="text-[9px] font-extrabold uppercase tracking-wide text-muted">Nivel</span>
          <select value={levelId} onChange={(event) => setLevelId(event.target.value)} disabled={!orderedLevels.length} className={SELECT_CLASS}>
            {orderedLevels.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="min-w-0 grid gap-1.5 p-3">
          <span className="text-[9px] font-extrabold uppercase tracking-wide text-muted">Grado</span>
          <select value={gradeId} onChange={(event) => setGradeId(event.target.value)} disabled={!grades.length} className={SELECT_CLASS}>
            {grades.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="min-w-0 grid gap-1.5 p-3">
          <span className="text-[9px] font-extrabold uppercase tracking-wide text-muted">Sección</span>
          <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} disabled={!sections.length} className={SELECT_CLASS}>
            {sections.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.shift}</option>)}
          </select>
        </label>
        <div className="col-span-2 grid content-center gap-1 bg-brand-900 px-4 py-2.5 text-white sm:col-span-4 lg:col-span-1">
          <small className="text-[8px] font-black tracking-[0.13em] text-brand-100">CONTEXTO ACTUAL</small>
          <strong className="text-xs">{selectedGrade?.name || "Sin grado"} · {selectedSection ? `Sección ${selectedSection.name}` : "Sin sección"}</strong>
          <span className="text-[9px] text-brand-100/80">{selectedLevel?.materialScope === "section" ? "Gestión directa por aula" : "Gestión por asignaturas"}</span>
        </div>
      </div>

      <nav className="mt-3 flex items-stretch overflow-x-auto border border-line border-b-[#89a69b] bg-[#f5f8f7]" role="tablist" aria-label="Áreas de gestión académica">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            ref={tab === id ? activeTabRef : null}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            key={id}
            className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 whitespace-nowrap border-r border-line px-[18px] text-[11px] font-extrabold sm:flex-none ${tab === id ? "border-b-[3px] border-b-gold bg-surface text-brand-900" : "border-b-[3px] border-b-transparent text-[#5e6e68]"}`}
          >
            <Icon className="h-4 w-4" />{label}
            {id === "matriculas" ? <span className="min-w-[20px] bg-[#dfe9e5] px-1.5 py-0.5 text-[8px] font-bold text-brand-900">{visibleEnrollments.length}</span> : null}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="grid min-h-[260px] place-content-center justify-items-center gap-2 p-8 text-center text-muted">
          <RefreshCw className="h-[29px] w-[29px] animate-spin text-brand-900 motion-reduce:animate-none" />
          <strong className="text-xs text-ink">Cargando gestión académica…</strong>
          <span className="max-w-[340px] text-[11px] leading-relaxed">Consultando estructura, perfiles y asignaciones.</span>
        </div>
      ) : !selectedSection && tab !== "auditoria" ? (
        <EmptyState icon={GraduationCap} title="No hay una sección disponible" text="Completa la estructura del año lectivo antes de configurar cursos y matrículas." />
      ) : (
        <>
          {tab === "cursos" ? (
            <CoursesPanel
              selectedLevel={selectedLevel}
              selectedGrade={selectedGrade}
              selectedSection={selectedSection}
              visibleOfferings={visibleOfferings}
              archivedOfferings={archivedOfferings}
              subjectById={subjectById}
              teachers={teachers}
              teacherChoices={teacherChoices}
              setTeacherChoices={setTeacherChoices}
              saveTeacher={saveTeacher}
              busyKey={busyKey}
              setCourseDialog={setCourseDialog}
              archiveOffering={archiveOffering}
              assignmentFor={assignmentFor}
              sectionTeacher={sectionTeacher}
              sectionTeacherKey={sectionTeacherKey}
            />
          ) : null}

          {tab === "matriculas" ? (
            <EnrollmentsPanel
              selectedYear={selectedYear}
              selectedLevel={selectedLevel}
              visibleEnrollments={visibleEnrollments}
              enrollmentHistory={enrollmentHistory}
              eligibleStudents={eligibleStudents}
              studentChoice={studentChoice}
              setStudentChoice={setStudentChoice}
              addEnrollment={addEnrollment}
              removeEnrollment={removeEnrollment}
              busyKey={busyKey}
              profileById={profileById}
            />
          ) : null}

          {tab === "auditoria" ? <AuditPanel auditEvents={workspace.audit} /> : null}
        </>
      )}

      {courseDialog ? <CourseDialog value={courseDialog} onClose={() => setCourseDialog(null)} onSubmit={saveCourse} busy={busyKey.startsWith("course-")} /> : null}
    </section>
  );
}
