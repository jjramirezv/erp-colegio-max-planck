import { ChevronRight, Pencil } from "lucide-react";
import Status from "./Status";

export default function DataTable({ columns, rows }) {
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="border-b border-line bg-[#f5f9f7] px-4 py-[14px] text-left text-[10px] uppercase tracking-[0.06em] text-brand-900">{c}</th>
            ))}
            <th className="border-b border-line bg-[#f5f9f7] px-4 py-[14px] text-left text-[10px] uppercase tracking-[0.06em] text-brand-900">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.join("-")} className="hover:bg-[#fbfdfc]">
              {row.map((cell, i) => (
                <td key={`${cell}-${i}`} className="border-b border-line px-4 py-[14px] text-left text-[11px]">
                  {i === row.length - 1 ? <Status value={cell} /> : cell}
                </td>
              ))}
              <td className="whitespace-nowrap border-b border-line px-4 py-[14px] text-left text-[11px]">
                <button className="border-0 bg-transparent p-[5px] text-brand-900" aria-label={`Editar fila ${index + 1}`}><Pencil size={15} /></button>
                <button className="border-0 bg-transparent p-[5px] text-brand-900" aria-label={`Ver fila ${index + 1}`}><ChevronRight size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
