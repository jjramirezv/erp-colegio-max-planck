import { History } from "lucide-react";

// Patrón "historial" colapsable compartido por el listado de cursos archivados
// y el de matrículas retiradas (misma envoltura visual, contenido distinto).
export default function HistoryDisclosure({ icon: Icon = History, title, count, children }) {
  if (!count) return null;
  return (
    <details className="m-3.5 border border-line bg-[#fbfcfc]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-[11px] font-extrabold text-brand-900 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5"><Icon className="h-[15px] w-[15px]" />{title}</span>
        <b className="min-w-[24px] bg-[#e5efeb] px-1.5 py-0.5 text-center text-[9px] font-normal">{count}</b>
      </summary>
      <div className="divide-y divide-line border-t border-line">{children}</div>
    </details>
  );
}
