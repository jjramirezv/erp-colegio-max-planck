import { LoaderCircle, Save } from "lucide-react";
import { ICON_ACTION_CLASS, SELECT_CLASS } from "../constants";

export default function CourseAssignment({ assignment, teachers, choice, onChoice, onSave, busy, compact = false }) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_34px] gap-1.5 pr-3 ${compact ? "min-w-[260px] sm:min-w-[330px] p-0" : ""}`}>
      <select
        aria-label="Docente asignado"
        value={choice}
        onChange={(event) => onChoice(event.target.value)}
        className={`${SELECT_CLASS} min-w-0`}
      >
        <option value="">Sin docente asignado</option>
        {teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.fullName}</option>)}
      </select>
      <button
        type="button"
        onClick={onSave}
        disabled={busy || choice === (assignment?.teacherId || "")}
        title="Guardar docente"
        aria-label="Guardar docente"
        className={ICON_ACTION_CLASS}
      >
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Save className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
