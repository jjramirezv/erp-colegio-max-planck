import { BookOpen, Plus } from "lucide-react";

export function EmptyState({ canCreate, onCreate, hasFilters, missingCourse = false, hasCourses = false }) {
  return (
    <div className="grid min-h-[320px] flex-1 place-content-center justify-items-center gap-2 p-[30px] text-center text-muted">
      <span className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-brand-800">
        <BookOpen className="h-6 w-6" />
      </span>
      <strong className="text-[14px] font-extrabold text-ink">
        {hasFilters ? "No encontramos coincidencias" : missingCourse ? hasCourses ? "Elige el curso para comenzar" : "Falta configurar un curso" : "Aún no hay materiales"}
      </strong>
      <p className="max-w-[300px] text-[11px] leading-[1.55]">
        {hasFilters ? "Ajusta la búsqueda o los filtros aplicados." : missingCourse ? hasCourses ? "Usa el selector Curso para consultar sus recursos y subir un nuevo archivo." : "Cuando el grado tenga cursos disponibles podrás subir sus materiales aquí." : "Registra el primer recurso para este curso y sección."}
      </p>
      {canCreate && !hasFilters ? (
        <button
          type="button"
          className="mt-[9px] inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[5px] border border-brand-800 bg-brand-800 px-[15px] text-[12px] font-bold leading-none text-white transition-colors enabled:hover:border-brand-950 enabled:hover:bg-brand-950 enabled:active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30"
          onClick={onCreate}
        >
          <Plus className="h-[17px] w-[17px]" /> Nuevo material
        </button>
      ) : null}
    </div>
  );
}

export default EmptyState;
