import { CheckCircle2, LoaderCircle, Plus, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { PANEL_CLASS, PRIMARY_BUTTON_CLASS, SELECT_CLASS } from "../constants";
import { formatDate } from "../utils";
import EmptyState from "./EmptyState";
import HistoryDisclosure from "./HistoryDisclosure";

export default function EnrollmentsPanel({
  selectedYear,
  selectedLevel,
  visibleEnrollments,
  enrollmentHistory,
  eligibleStudents,
  studentChoice,
  setStudentChoice,
  addEnrollment,
  removeEnrollment,
  busyKey,
  profileById,
}) {
  return (
    <div className={PANEL_CLASS} role="tabpanel">
      <header className="flex min-h-[94px] flex-col gap-3 border-b border-line bg-[#fbfcfc] px-[19px] py-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-0.5">
          <small className="text-[8px] font-black tracking-[0.13em] text-brand-800">{selectedYear?.name} · {selectedLevel?.name}</small>
          <h2 className="m-0 font-sans text-lg font-extrabold tracking-tight">Matrículas de la sección</h2>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">Solo aparecen estudiantes con perfil activo. Las credenciales se crean y administran desde Usuarios.</p>
        </div>
        <span className="grid min-w-[92px] justify-items-center border-l-[3px] border-gold bg-amber-soft px-3 py-2 text-[9px] text-muted">
          <strong className="font-sans text-xl font-extrabold text-ink">{visibleEnrollments.length}</strong> estudiantes
        </span>
      </header>

      <div className="grid grid-cols-1 gap-2.5 border-b border-line bg-[#f5f9f7] px-4 py-3.5 sm:grid-cols-[1fr_auto] md:grid-cols-[minmax(200px,1fr)_minmax(260px,1.3fr)_auto] md:items-center">
        <div className="flex items-center gap-2.5 sm:col-span-2 md:col-span-1">
          <UserPlus className="h-[25px] w-[25px] text-brand-900" />
          <span className="grid gap-0.5">
            <strong className="text-[10px]">Matricular estudiante</strong>
            <small className="text-[8px] text-muted">Disponibles en el año: {eligibleStudents.length}</small>
          </span>
        </div>
        <select aria-label="Estudiante disponible" value={studentChoice} onChange={(event) => setStudentChoice(event.target.value)} className={SELECT_CLASS}>
          <option value="">Selecciona un perfil de estudiante</option>
          {eligibleStudents.map((student) => <option value={student.id} key={student.id}>{student.fullName}</option>)}
        </select>
        <button type="button" className={`${PRIMARY_BUTTON_CLASS} w-full md:w-auto`} onClick={addEnrollment} disabled={!studentChoice || busyKey === "enroll"}>
          {busyKey === "enroll" ? <LoaderCircle className="h-[15px] w-[15px] animate-spin motion-reduce:animate-none" /> : <Plus className="h-[15px] w-[15px]" />}
          Matricular
        </button>
      </div>

      {visibleEnrollments.length ? (
        <div>
          <div className="hidden min-h-[37px] items-center bg-[#f1f6f4] px-4 text-[8px] font-black uppercase tracking-[0.09em] text-[#52665e] md:grid md:grid-cols-[minmax(240px,1.2fr)_150px_150px_90px]">
            <span>Estudiante</span><span>Ingreso</span><span>Estado</span><span>Acción</span>
          </div>
          {visibleEnrollments.map((enrollment) => {
            const student = profileById.get(String(enrollment.studentId));
            return (
              <article key={enrollment.id} className="grid grid-cols-2 items-center gap-3 border-t border-line px-4 py-2.5 text-[10px] md:grid-cols-[minmax(240px,1.2fr)_150px_150px_90px] md:gap-0">
                <div className="col-span-2 flex min-w-0 items-center gap-2.5 md:col-span-1">
                  <span className="grid h-[35px] w-[35px] shrink-0 place-items-center border border-[#8fa99f] bg-[#eef6f3] text-[9px] font-black text-brand-900">
                    {student?.fullName?.split(" ").map((part) => part[0]).slice(0, 2).join("") || "ES"}
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px]">{student?.fullName || "Perfil no disponible"}</strong>
                    <small className="text-[8px] text-muted">ID académico · {String(enrollment.id).slice(-8)}</small>
                  </div>
                </div>
                <span>
                  <span className="mr-1 text-[9px] font-black uppercase tracking-wide text-muted md:hidden">Ingreso</span>
                  {formatDate(enrollment.enrolledOn)}
                </span>
                <span className="flex w-max items-center gap-1 bg-[#e6f5ef] px-2 py-1 text-[8px] font-black text-[#087558]">
                  <CheckCircle2 className="h-3 w-3" />Matriculado
                </span>
                <div className="col-span-2 flex items-center justify-end gap-1.5 md:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeEnrollment(enrollment)}
                    disabled={busyKey === `withdraw-${enrollment.id}`}
                    className="flex h-[34px] min-w-[34px] items-center justify-center gap-1.5 border border-[#e1b3af] bg-surface px-0 text-[9px] font-extrabold text-[#a2332d] disabled:cursor-not-allowed disabled:opacity-45 md:min-w-[76px] md:px-2.5"
                  >
                    {busyKey === `withdraw-${enrollment.id}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <UserMinus className="h-3.5 w-3.5" />}
                    <span className="hidden md:inline">Retirar</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={UsersRound} title="Aún no hay estudiantes matriculados" text="Selecciona un perfil disponible para incorporarlo a esta sección." />
      )}

      <HistoryDisclosure title="Historial de matrícula" count={enrollmentHistory.length}>
        {enrollmentHistory.map((enrollment) => {
          const student = profileById.get(String(enrollment.studentId));
          return (
            <article key={enrollment.id} className="flex min-h-[52px] items-center justify-between gap-4 px-3.5 py-2.5">
              <div className="grid gap-0.5">
                <strong className="text-[11px]">{student?.fullName || "Perfil no disponible"}</strong>
                <small className="text-[9px] text-muted">
                  Ingreso {formatDate(enrollment.enrolledOn)}{enrollment.withdrawnOn ? ` · Retiro ${formatDate(enrollment.withdrawnOn)}` : ""}
                </small>
              </div>
              <span className="text-[9px] font-extrabold capitalize text-[#8b4b38]">{enrollment.status === "withdrawn" ? "Retirado" : enrollment.status}</span>
            </article>
          );
        })}
      </HistoryDisclosure>
    </div>
  );
}
