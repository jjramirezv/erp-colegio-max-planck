import { History } from "lucide-react";
import { ACTION_LABELS, COUNT_BADGE_CLASS, ENTITY_LABELS, PANEL_CLASS } from "../constants";
import { formatDate, shortDetails } from "../utils";
import EmptyState from "./EmptyState";

function auditMarkClass(action) {
  if (action === "published" || action === "distributed") return "border-[#e3bc6a] bg-[#fff6e3] text-[#966000]";
  if (action === "archived" || action === "deleted") return "border-[#dfafab] bg-[#fff1ef] text-[#a23530]";
  return "border-[#8fa99f] bg-[#edf5f2] text-brand-900";
}

export default function AuditPanel({ auditEvents }) {
  return (
    <div className={PANEL_CLASS} role="tabpanel">
      <header className="flex min-h-[94px] flex-col gap-3 border-b border-line bg-[#fbfcfc] px-[19px] py-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-0.5">
          <small className="text-[8px] font-black tracking-[0.13em] text-brand-800">TRAZABILIDAD</small>
          <h2 className="m-0 font-sans text-lg font-extrabold tracking-tight">Auditoría académica y de materiales</h2>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">Cursos, asignaciones, matrículas, publicaciones y entregas con actor y fecha.</p>
        </div>
        <span className={COUNT_BADGE_CLASS}>
          <strong className="font-sans text-xl font-extrabold text-ink">{auditEvents.length}</strong> eventos
        </span>
      </header>

      {auditEvents.length ? (
        <div>
          {auditEvents.map((event) => (
            <article
              key={event.id}
              className="grid grid-cols-[32px_1fr] gap-3 border-b border-line px-3 py-2.5 last:border-b-0 sm:grid-cols-[34px_1fr_auto] md:grid-cols-[36px_minmax(260px,1fr)_180px_145px] md:items-center md:gap-2.5 md:px-4"
            >
              <span className={`grid h-[38px] w-[34px] place-items-center border ${auditMarkClass(event.action)}`}>
                <History className="h-[15px] w-[15px]" />
              </span>
              <div className="min-w-0 grid gap-1.5">
                <header className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center">
                  <strong className="text-[10px]">{ACTION_LABELS[event.action] || event.action}</strong>
                  <span className="bg-[#edf3f1] px-1.5 py-0.5 text-[8px] font-extrabold text-[#52655e]">
                    {ENTITY_LABELS[event.entityType] || event.entityType}{event.entityId ? ` #${event.entityId}` : ""}
                  </span>
                </header>
                <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-muted">{shortDetails(event.details)}</p>
              </div>
              <div className="col-span-2 grid gap-0.5 sm:col-auto">
                <strong className="text-[9px]">{event.actorName || "Sistema"}</strong>
                <span className="text-[8px] capitalize text-muted">{event.actorRole?.replaceAll("_", " ") || "Proceso automático"}</span>
              </div>
              <time dateTime={event.createdAt} className="col-span-2 text-left text-[8px] text-muted sm:col-auto sm:text-right">
                {formatDate(event.createdAt, true)}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState icon={History} title="Todavía no hay eventos" text="Las altas, versiones, publicaciones y entregas de materiales aparecerán aquí automáticamente." />
      )}
    </div>
  );
}
