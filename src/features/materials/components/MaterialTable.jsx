import { Archive, Check, MoreVertical, PanelRight, Pencil } from "lucide-react";
import { FileBadge } from "./FileBadge";
import { StatusBadge } from "./StatusBadge";
import { formatDate, statusKey } from "../utils";

const TH_CLASS = "h-11 whitespace-nowrap bg-[#f7f9f8] px-[10px] text-left text-[10px] font-extrabold text-[#27322e]";
const TD_CLASS = "h-[72px] border-t border-line px-[10px] py-[10px] align-middle text-[11px] leading-[1.4] text-[#36413d]";
const MENU_ITEM_CLASS =
  "flex min-h-[38px] w-full items-center gap-2 border-t border-line px-[11px] text-left text-[10px] font-semibold text-ink first:border-t-0 hover:bg-brand-50";

export function MaterialTable({
  materials,
  selectedId,
  menuFor,
  onMenu,
  onSelect,
  permissions,
  onEdit,
  onPublish,
  onArchive,
}) {
  return (
    <div className="hidden overflow-auto border-t border-line [scrollbar-color:#b8c6c1_transparent] [scrollbar-width:thin] md:block">
      <table className="w-full min-w-[690px] table-fixed border-collapse">
        <thead>
          <tr>
            <th className={`${TH_CLASS} w-[27%]`}>Material</th>
            <th className={`${TH_CLASS} w-[12%]`}>Origen</th>
            <th className={`${TH_CLASS} w-[12%]`}>Entrega</th>
            <th className={`${TH_CLASS} w-[10%]`}>Versión</th>
            <th className={`${TH_CLASS} w-[13%]`}>Estado</th>
            <th className={`${TH_CLASS} w-[18%]`}>Actualizado</th>
            <th className={`${TH_CLASS} w-[8%]`}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => {
            const selected = material.id === selectedId;
            const editable = permissions.canEdit(material);
            return (
              <tr
                key={material.id}
                className={`relative cursor-pointer transition-colors hover:bg-[#fbfdfc] ${
                  selected ? "bg-gradient-to-r from-[#edf7f3] to-[#f7fbf9] shadow-[inset_3px_0_0_0_var(--color-brand-700)]" : ""
                }`}
                onClick={() => onSelect(material.id)}
              >
                <td className={TD_CLASS}>
                  <button
                    type="button"
                    className="grid w-full grid-cols-[38px_minmax(0,1fr)] items-center gap-[10px] text-left text-[11px] font-bold leading-[1.35] text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30"
                    onClick={() => onSelect(material.id)}
                  >
                    <FileBadge type={material.fileType} compact />
                    <span className="truncate">{material.title}</span>
                  </button>
                </td>
                <td className={TD_CLASS}>{material.origin || "Institucional"}</td>
                <td className={TD_CLASS}>{material.delivery || "Digital"}</td>
                <td className={TD_CLASS}>{material.version || "1.0"}</td>
                <td className={TD_CLASS}>
                  <StatusBadge status={material.status} />
                </td>
                <td className={TD_CLASS}>
                  <time dateTime={material.updatedAt}>{formatDate(material.updatedAt, true)}</time>
                </td>
                <td className={`${TD_CLASS} relative text-center`}>
                  <button
                    type="button"
                    className="inline-grid h-[30px] w-[30px] place-items-center rounded border border-transparent bg-transparent text-[#24332e] hover:border-brand-800 hover:bg-brand-50 hover:text-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30"
                    aria-label={`Acciones de ${material.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuFor === material.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onMenu(menuFor === material.id ? null : material.id);
                    }}
                  >
                    <MoreVertical className="h-[17px] w-[17px]" />
                  </button>
                  {menuFor === material.id ? (
                    <div
                      className="absolute right-[9px] top-[53px] z-[25] w-[148px] overflow-hidden rounded-[5px] border border-line-strong bg-white shadow-[0_12px_30px_rgba(3,42,31,0.15)]"
                      role="menu"
                    >
                      <button type="button" role="menuitem" className={MENU_ITEM_CLASS} onClick={() => onSelect(material.id)}>
                        <PanelRight className="h-[15px] w-[15px] text-brand-800" /> Ver detalle
                      </button>
                      {editable ? (
                        <button type="button" role="menuitem" className={MENU_ITEM_CLASS} onClick={() => onEdit(material)}>
                          <Pencil className="h-[15px] w-[15px] text-brand-800" /> Editar
                        </button>
                      ) : null}
                      {permissions.canPublish(material) && statusKey(material.status) !== "published" ? (
                        <button type="button" role="menuitem" className={MENU_ITEM_CLASS} onClick={() => onPublish(material)}>
                          <Check className="h-[15px] w-[15px] text-brand-800" /> Publicar
                        </button>
                      ) : null}
                      {permissions.canArchive(material) && statusKey(material.status) !== "archived" ? (
                        <button
                          type="button"
                          role="menuitem"
                          className={`${MENU_ITEM_CLASS} text-red`}
                          onClick={() => onArchive(material)}
                        >
                          <Archive className="h-[15px] w-[15px] text-red" /> Archivar
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MaterialTable;
