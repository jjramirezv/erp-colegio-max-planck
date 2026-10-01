import { useMemo, useState } from "react";
import { CheckCircle2, Download, Filter, Plus, Search, X } from "lucide-react";
import { roles } from "../../data";
import PageHeading from "../../components/PageHeading";
import SummaryBand from "./SummaryBand";
import DataTable from "./DataTable";
import { adminData, moduleConfig, payments, students } from "./data/seed";

export default function DirectoryModule({ module, user }) {
  const config = moduleConfig[module] || moduleConfig.Estudiantes;
  const [tab, setTab] = useState(config.tabs?.[0] || "Todos");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  let data = config.data;
  let columns = config.columns;
  if (module === "Administración" && tab === "Tesorería") { data = payments; columns = moduleConfig.Tesorería.columns; }
  if (module === "Administración" && tab === "Asistencia") { data = students; columns = moduleConfig.Estudiantes.columns; }
  if (module === "Administración" && adminData[tab]) {
    data = adminData[tab];
    const map = { Personal: ["Docente", "Especialidad", "Nivel", "Cursos", "Carga", "Estado"], Inventario: ["Código", "Bien", "Categoría", "Cantidad", "Ubicación", "Estado"], Documentos: ["Código", "Documento", "Área", "Fecha", "Responsable", "Estado"], Incidencias: ["Código", "Incidencia", "Prioridad", "Área", "Responsable", "Estado"], Reportes: ["Código", "Reporte", "Área", "Periodo", "Formato", "Estado"] };
    columns = map[tab];
  }
  const filtered = useMemo(() => data.filter((row) => row.join(" ").toLowerCase().includes(query.toLowerCase())), [data, query]);
  return (
    <>
      <PageHeading
        title={config.title}
        description={config.description}
        action={
          <button
            className="flex h-[42px] items-center justify-center gap-2 border-0 bg-brand-900 px-[18px] text-sm font-bold text-white hover:bg-[#07664e] max-md:w-[42px] max-md:px-0"
            onClick={() => setNotice("Registro preparado. Se conectará a Supabase en producción.")}
          >
            <Plus size={17} /><span className="max-md:hidden">Nuevo registro</span>
          </button>
        }
      />
      <SummaryBand module={module} />
      {config.tabs && (
        <div className="flex border-b border-line">
          {config.tabs.map((item) => (
            <button
              key={item}
              className={`border-0 border-b-2 border-transparent bg-transparent px-[22px] py-[14px] text-xs font-semibold text-muted ${tab === item ? "border-brand-900 text-brand-900" : ""}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-[10px] bg-brand-100 px-4 py-3 text-xs text-brand-900">
          <CheckCircle2 size={17} />{notice}
          <button className="ml-auto border-0 bg-transparent text-inherit" onClick={() => setNotice("")}><X size={15} /></button>
        </div>
      )}
      <section className="border border-line bg-white">
        <div className="flex flex-wrap items-center gap-[10px] border-b border-line px-4 py-[14px]">
          <label className="flex max-w-full flex-1 basis-full items-center gap-2 border border-line px-[11px] text-muted md:max-w-[480px] md:basis-auto">
            <Search size={17} />
            <input className="h-10 min-w-0 flex-1 border-0" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en este módulo" />
          </label>
          <span className="text-[11px] text-muted md:ml-auto">{filtered.length} registros</span>
          <button className="flex h-10 items-center gap-[7px] border border-line bg-white px-[13px] text-[11px] font-semibold text-brand-900"><Filter size={16} /> Filtrar</button>
          <button className="flex h-10 items-center gap-[7px] border border-line bg-white px-[13px] text-[11px] font-semibold text-brand-900"><Download size={16} /> Exportar</button>
        </div>
        <DataTable columns={columns} rows={filtered} />
      </section>
      <p className="my-[14px] flex items-center gap-[7px] text-[11px] text-muted">
        <CheckCircle2 className="text-brand-800" size={15} /> Vista habilitada para {roles[user.role]}. Alta Dirección conserva acceso total a este módulo.
      </p>
    </>
  );
}
