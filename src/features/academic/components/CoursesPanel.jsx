import { Archive, BookOpenCheck, LoaderCircle, Pencil, Plus, UsersRound } from "lucide-react";
import { PANEL_CLASS, PRIMARY_BUTTON_CLASS } from "../constants";
import CourseAssignment from "./CourseAssignment";
import EmptyState from "./EmptyState";
import HistoryDisclosure from "./HistoryDisclosure";

export default function CoursesPanel({
  selectedLevel,
  selectedGrade,
  selectedSection,
  visibleOfferings,
  archivedOfferings,
  subjectById,
  teachers,
  teacherChoices,
  setTeacherChoices,
  saveTeacher,
  busyKey,
  setCourseDialog,
  archiveOffering,
  assignmentFor,
  sectionTeacher,
  sectionTeacherKey,
}) {
  const isSectionScope = selectedLevel?.materialScope === "section";

  return (
    <div className={PANEL_CLASS} role="tabpanel">
      <header className="flex min-h-[94px] flex-col gap-3 border-b border-line bg-[#fbfcfc] px-[19px] py-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-0.5">
          <small className="text-[8px] font-black tracking-[0.13em] text-brand-800">{selectedLevel?.name?.toUpperCase()}</small>
          <h2 className="m-0 font-sans text-lg font-extrabold tracking-tight">{isSectionScope ? "Responsable del aula" : "Cursos y docentes"}</h2>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
            {isSectionScope
              ? "En Inicial, el docente y los materiales se gestionan directamente desde la sección."
              : "Cada asignatura se configura para la sección y mantiene su propio responsable."}
          </p>
        </div>
        {!isSectionScope ? (
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCourseDialog({ mode: "create" })}>
            <Plus className="h-[15px] w-[15px]" />Agregar curso
          </button>
        ) : null}
      </header>

      {isSectionScope ? (
        <article className="my-5 grid min-h-[145px] grid-cols-[48px_1fr] items-center gap-4 border border-[#91afa4] bg-[#f8fbfa] p-3.5 md:grid-cols-[58px_minmax(220px,1fr)_minmax(330px,0.9fr)] md:p-[18px]">
          <div className="grid h-[46px] w-[46px] place-items-center bg-brand-900 text-white md:h-[60px] md:w-[54px]">
            <UsersRound className="h-6 w-6" />
          </div>
          <div className="grid gap-1">
            <small className="text-[8px] font-black tracking-[0.12em] text-brand-800">DOCENTE TITULAR</small>
            <h3 className="m-0 font-sans text-base font-extrabold">{selectedGrade.name} · Sección {selectedSection.name}</h3>
            <p className="m-0 text-[10px] leading-relaxed text-muted">El responsable verá los materiales y la asistencia de todo este salón.</p>
          </div>
          <div className="col-span-2 min-w-0 md:col-span-1">
            <CourseAssignment
              compact
              assignment={sectionTeacher}
              teachers={teachers}
              choice={teacherChoices[sectionTeacherKey] ?? sectionTeacher?.teacherId ?? ""}
              onChoice={(value) => setTeacherChoices((current) => ({ ...current, [sectionTeacherKey]: value }))}
              onSave={() => saveTeacher("section", selectedSection.id)}
              busy={busyKey === `teacher-${sectionTeacherKey}`}
            />
          </div>
        </article>
      ) : visibleOfferings.length ? (
        <div>
          <div className="hidden min-h-[37px] items-center border-b border-line bg-[#f1f6f4] px-4 text-[8px] font-black uppercase tracking-[0.09em] text-[#52665e] md:grid md:grid-cols-[minmax(230px,1.3fr)_90px_minmax(255px,1fr)_90px]">
            <span>Curso</span><span>Carga</span><span>Docente responsable</span><span>Acciones</span>
          </div>
          {visibleOfferings.map((offering) => {
            const subject = subjectById.get(String(offering.subjectId));
            const assignment = assignmentFor("courseOfferingId", offering.id);
            const choiceKey = `course:${offering.id}`;
            return (
              <article
                key={offering.id}
                className="grid grid-cols-2 items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-[#fbfdfc] md:grid-cols-[minmax(230px,1.3fr)_90px_minmax(255px,1fr)_90px] md:gap-0"
              >
                <div className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center border border-[#6e9688] bg-brand-900 text-[9px] font-black text-white">
                    {(subject?.code || "CU").slice(0, 3)}
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px]">{offering.displayName || subject?.name || "Curso sin nombre"}</strong>
                    <small className="overflow-hidden text-ellipsis whitespace-nowrap text-[8px] text-muted">{subject?.code || "Sin código"} · {subject?.name || "Asignatura"}</small>
                  </div>
                </div>
                <div className="grid gap-0.5 text-right md:text-left">
                  <span className="block text-[9px] font-black uppercase tracking-wide text-muted md:hidden">Carga</span>
                  <strong className="text-xs">{offering.weeklyHours || "—"}</strong>
                  <small className="text-[8px] text-muted">h/semana</small>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-muted md:hidden">Docente</span>
                  <CourseAssignment
                    assignment={assignment}
                    teachers={teachers}
                    choice={teacherChoices[choiceKey] ?? assignment?.teacherId ?? ""}
                    onChoice={(value) => setTeacherChoices((current) => ({ ...current, [choiceKey]: value }))}
                    onSave={() => saveTeacher("course", offering.id)}
                    busy={busyKey === `teacher-${choiceKey}`}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1.5 md:col-span-1">
                  <button
                    type="button"
                    onClick={() => setCourseDialog({
                      mode: "edit",
                      id: offering.id,
                      code: subject?.code || "",
                      subjectName: subject?.name || "",
                      displayName: offering.displayName || "",
                      weeklyHours: offering.weeklyHours || "",
                    })}
                    title="Editar curso"
                    className="grid h-[34px] w-[34px] place-items-center border border-[#aac0b8] bg-surface text-brand-900 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => archiveOffering(offering)}
                    disabled={busyKey === `archive-${offering.id}`}
                    title="Archivar curso"
                    className="grid h-[34px] w-[34px] place-items-center border border-[#e1b3af] bg-surface text-[#a2332d] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyKey === `archive-${offering.id}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Archive className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={BookOpenCheck} title="Esta sección todavía no tiene cursos" text="Agrega la primera asignatura y luego selecciona al docente responsable." />
      )}

      <HistoryDisclosure title="Historial de cursos" count={archivedOfferings.length}>
        {archivedOfferings.map((offering) => {
          const subject = subjectById.get(String(offering.subjectId));
          return (
            <article key={offering.id} className="flex min-h-[52px] items-center justify-between gap-4 px-3.5 py-2.5">
              <div className="grid gap-0.5">
                <strong className="text-[11px]">{offering.displayName || subject?.name || "Curso archivado"}</strong>
                <small className="text-[9px] text-muted">{subject?.code || "Curso"} · Conservado para auditoría</small>
              </div>
              <span className="text-[9px] font-extrabold capitalize text-[#8b4b38]">Archivado</span>
            </article>
          );
        })}
      </HistoryDisclosure>
    </div>
  );
}
