import { ChevronRight } from "lucide-react";
import { FileBadge } from "./FileBadge";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "../utils";

export function MaterialCards({ materials, selectedId, onSelect }) {
  return (
    <div className="grid gap-[10px] md:hidden">
      {materials.map((material) => {
        const selected = selectedId === material.id;
        return (
          <button
            type="button"
            key={material.id}
            className={`relative grid min-h-[119px] grid-cols-[58px_minmax(0,1fr)_16px] items-center gap-2 rounded-[6px] border border-line bg-white p-[12px_10px] text-left text-ink hover:border-brand-800 hover:bg-[#fbfefc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30 mm-sm:min-h-[116px] mm-sm:grid-cols-[66px_minmax(0,1fr)_auto_18px] mm-sm:gap-[10px] mm-sm:p-[13px] ${
              selected ? "border-brand-800 bg-[#fbfefc] shadow-[inset_3px_0_0_0_var(--color-brand-700)]" : ""
            }`}
            onClick={() => onSelect(material.id)}
          >
            <span className="origin-left scale-90 mm-sm:scale-100">
              <FileBadge type={material.fileType} />
            </span>
            <span className="grid min-w-0 gap-2 pt-5 mm-sm:pt-0">
              <strong className="truncate text-[13px] font-extrabold leading-[1.25] text-[#111815] mm-sm:text-[14px]">
                {material.title}
              </strong>
              <span className="truncate text-[9px] leading-[1.35] text-muted mm-sm:text-[10px]">
                Origen: {material.origin || "Institucional"} <i className="mx-[5px] not-italic">·</i> Entrega:{" "}
                {material.delivery || "Digital"}
              </span>
              <span className="truncate text-[9px] leading-[1.35] text-muted mm-sm:text-[10px]">
                Versión {material.version || "1.0"} <i className="mx-[5px] not-italic">·</i> Actualizado:{" "}
                {formatDate(material.updatedAt)}
              </span>
            </span>
            <span className="absolute right-[35px] top-[11px] mm-sm:static mm-sm:self-start mm-sm:pt-[3px]">
              <StatusBadge status={material.status} />
            </span>
            <ChevronRight aria-hidden="true" className="hidden h-[18px] w-[18px] text-[#17211e] mm-sm:block" />
          </button>
        );
      })}
    </div>
  );
}

export default MaterialCards;
