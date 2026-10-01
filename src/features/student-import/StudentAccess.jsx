import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, History, KeyRound, RefreshCw, Search } from "lucide-react";
import PageHeading from "../../components/PageHeading";
import { downloadCSV } from "./csv";
import { loadImportCatalog, loadImportHistory, loadImportRows, loadStudentAccess, regenerateCredentials } from "./importApi";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-brand-900 disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} !bg-brand-900 !text-white`;
const formatDate = (value) => value ? new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "Nunca";
const classroom = (student) => student.sectionId ? `${student.level} · ${student.grade} ${student.section}` : "Sin matrícula en este año";
const portalUrl = () => `${window.location.origin}${window.location.pathname}`;

function Students() {
  const [catalog, setCatalog] = useState(null);
  const [yearId, setYearId] = useState("");
  const [students, setStudents] = useState([]);
  const [level, setLevel] = useState("");
  const [grade, setGrade] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [access, setAccess] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generated, setGenerated] = useState([]);

  useEffect(() => {
    loadImportCatalog().then((result) => { setCatalog(result); setYearId(String(result.years[0]?.id || "")); }).catch((failure) => { setError(failure.message); setLoading(false); });
  }, []);
  const refresh = useCallback(async () => {
    if (!yearId) return;
    setLoading(true); setError("");
    try { setStudents(await loadStudentAccess(yearId)); setSelected(new Set()); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }, [yearId]);
  useEffect(() => { refresh(); }, [refresh]);

  const sections = catalog?.sections.filter((item) => String(item.yearId) === yearId) || [];
  const levels = [...new Set(sections.map((item) => item.level))];
  const grades = [...new Set(sections.filter((item) => item.level === level).map((item) => item.grade))];
  const classrooms = sections.filter((item) => item.level === level && item.grade === grade);
  const normalized = query.trim().toLocaleLowerCase("es-PE");
  const filtered = useMemo(() => students.filter((student) =>
    (!level || student.level === level) && (!grade || student.grade === grade) && (!sectionId || String(student.sectionId) === sectionId)
    && (access === "all" || (access === "never" ? !student.lastSignInAt : Boolean(student.lastSignInAt)))
    && (!normalized || `${student.name} ${student.dni || ""} ${student.email}`.toLocaleLowerCase("es-PE").includes(normalized))
  ), [students, level, grade, sectionId, access, normalized]);
  const allSelected = filtered.length > 0 && filtered.every((student) => selected.has(student.id));
  const neverCount = students.filter((student) => !student.lastSignInAt).length;

  function toggle(id) {
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleAll() {
    setSelected((current) => { const next = new Set(current); filtered.forEach((student) => allSelected ? next.delete(student.id) : next.add(student.id)); return next; });
  }
  function download(list) {
    const byId = new Map(students.map((student) => [student.id, student]));
    downloadCSV("credenciales-estudiantes.csv", [["dni", "nombre", "correo", "clave", "salon", "portal"], ...list.map((item) => { const student = byId.get(item.id) || {}; return [student.dni, student.name, item.email, item.password, classroom(student), portalUrl()]; })]);
  }
  async function generate() {
    const ids = students.filter((student) => selected.has(student.id)).map((student) => student.id);
    if (!ids.length) return;
    if (!window.confirm(`La clave de ${ids.length} estudiante(s) volverá a ser su DNI. ¿Continuar?`)) return;
    setBusy(true); setError(""); setNotice("");
    const ok = []; const failed = [];
    try {
      for (let start = 0; start < ids.length; start += 50) {
        const results = await regenerateCredentials(ids.slice(start, start + 50));
        results.forEach((item) => (item.password ? ok : failed).push(item));
      }
    } catch (failure) { setError(`${failure.message} Se restablecieron ${ok.length} clave(s) antes del error.`); }
    finally {
      setBusy(false);
      if (ok.length) { setGenerated(ok); download(ok); setNotice(`Se restableció la clave de ${ok.length} estudiante(s) a su DNI y se descargó credenciales-estudiantes.csv.${failed.length ? ` ${failed.length} no se pudieron restablecer.` : ""}`); }
      else if (failed.length) setError(failed[0].error);
      refresh();
    }
  }

  if (!catalog) return <p role="status" className="text-sm">{error || "Cargando años y salones…"}</p>;
  return <div className="space-y-4">
    <section className="grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid min-w-0 gap-2 text-sm font-semibold">Año lectivo<select aria-label="Año lectivo" className={`${button} w-full`} value={yearId} onChange={(event) => { setYearId(event.target.value); setLevel(""); setGrade(""); setSectionId(""); }}>{catalog.years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold">Nivel<select aria-label="Nivel" className={`${button} w-full`} value={level} onChange={(event) => { setLevel(event.target.value); setGrade(""); setSectionId(""); }}><option value="">Todos</option>{levels.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold">Grado<select aria-label="Grado" className={`${button} w-full`} value={grade} disabled={!level} onChange={(event) => { setGrade(event.target.value); setSectionId(""); }}><option value="">Todos</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold">Sección<select aria-label="Sección" className={`${button} w-full`} value={sectionId} disabled={!grade} onChange={(event) => setSectionId(event.target.value)}><option value="">Todas</option>{classrooms.map((item) => <option key={item.id} value={item.id}>{item.section}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3 sm:col-span-2 lg:col-span-3"><Search size={16} className="text-muted" /><input aria-label="Buscar estudiante" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Buscar por nombre, DNI o correo" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label="Filtrar por ingreso" className={button} value={access} onChange={(event) => setAccess(event.target.value)}><option value="all">Todos los accesos</option><option value="never">Nunca ingresaron ({neverCount})</option><option value="signed">Ya ingresaron</option></select>
    </section>
    {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
    {notice ? <div role="status" className="rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">{notice}{generated.length ? <button className={`${button} ml-3`} onClick={() => download(generated)}><Download size={16} />Descargar de nuevo</button> : null}</div> : null}
    <section className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <span className="text-sm">{filtered.length} estudiante(s) · {selected.size} seleccionado(s)</span>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={loading || busy} onClick={refresh}><RefreshCw size={16} />Actualizar</button><button className={primary} disabled={busy || !selected.size} onClick={generate}><KeyRound size={16} />{busy ? "Restableciendo…" : `Restablecer clave al DNI (${selected.size})`}</button></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-brand-50"><tr><th className="p-3"><input type="checkbox" aria-label="Seleccionar todos" checked={allSelected} onChange={toggleAll} disabled={!filtered.length} /></th>{["Estudiante", "Correo de acceso", "Salón", "Último ingreso", "Clave restablecida"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} className="p-6 text-center text-muted">Cargando estudiantes…</td></tr> : filtered.length ? filtered.map((student) => <tr key={student.id} className="border-t border-line">
          <td className="p-3"><input type="checkbox" aria-label={`Seleccionar ${student.name}`} checked={selected.has(student.id)} onChange={() => toggle(student.id)} /></td>
          <td className="p-3"><strong>{student.name}</strong><small className="block text-muted">DNI {student.dni || "—"}{student.active ? "" : " · Inactivo"}</small></td>
          <td className="max-w-[240px] break-words p-3">{student.email}</td>
          <td className="p-3">{classroom(student)}</td>
          <td className={`p-3 ${student.lastSignInAt ? "" : "font-semibold text-amber-700"}`}>{formatDate(student.lastSignInAt)}</td>
          <td className="p-3 text-muted">{formatDate(student.credentialsAt)}</td>
        </tr>) : <tr><td colSpan={6} className="p-6 text-center text-muted">{students.length ? "Ningún estudiante coincide con los filtros." : "Aún no hay estudiantes. Créalos desde Importar estudiantes."}</td></tr>}</tbody></table></div>
    </section>
    <p className="text-xs text-muted">Cada estudiante ingresa con DNI@estudiantes.maxplanck.edu.pe y su DNI como clave. Si alguno la cambió u olvidó, selecciónalo y restablécela al DNI.</p>
  </div>;
}

function ImportHistory() {
  const [batches, setBatches] = useState(null);
  const [open, setOpen] = useState(null);
  const [detail, setDetail] = useState([]);
  const [error, setError] = useState("");
  const refresh = useCallback(() => { setError(""); loadImportHistory().then(setBatches).catch((failure) => setError(failure.message)); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  async function show(batch) {
    if (open === batch.id) { setOpen(null); return; }
    setError("");
    try { setDetail(await loadImportRows(batch.id)); setOpen(batch.id); } catch (failure) { setError(failure.message); }
  }
  function downloadDetail(batch) {
    downloadCSV(`carga-${batch.id}-estudiantes.csv`, [["fila", "dni", "nombre", "correo", "salon", "estado", "cuenta", "detalle", "procesado"], ...detail.map((row) => [row.fila, row.dni, row.nombre, row.correo, row.salon, row.estado === "done" ? "Completado" : "Error", row.cuenta_nueva ? "Nueva" : "Existente", row.mensaje, formatDate(row.procesado_en)])]);
  }
  if (error) return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className={`${button} ml-3`} onClick={refresh}>Reintentar</button></div>;
  if (!batches) return <p role="status" className="text-sm">Cargando historial…</p>;
  if (!batches.length) return <p className="rounded-lg border border-line bg-white p-6 text-center text-sm text-muted">Todavía no hay cargas registradas.</p>;
  return <section className="overflow-hidden rounded-lg border border-line bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
    <thead className="bg-brand-50"><tr>{["Fecha", "Archivo", "Año", "Realizado por", "Filas", "Nuevas", "Existentes", "Errores", "Pendientes", ""].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
    <tbody>{batches.map((batch) => {
      const pending = Math.max(0, batch.total - batch.cuentas_nuevas - batch.cuentas_existentes - batch.errores);
      return [<tr key={batch.id} className="border-t border-line">
        <td className="p-3">{formatDate(batch.creado_en)}</td><td className="max-w-[200px] break-words p-3">{batch.archivo}</td><td className="p-3">{batch.anio?.nombre || "—"}</td><td className="p-3">{batch.autor?.nombre_completo || "—"}</td>
        <td className="p-3">{batch.total}</td><td className="p-3 text-brand-900">{batch.cuentas_nuevas}</td><td className="p-3">{batch.cuentas_existentes}</td><td className={`p-3 ${batch.errores ? "font-semibold text-red-800" : ""}`}>{batch.errores}</td><td className="p-3">{pending}</td>
        <td className="p-3"><button className={button} onClick={() => show(batch)}>{open === batch.id ? "Ocultar" : "Ver detalle"}</button></td>
      </tr>, open === batch.id ? <tr key={`${batch.id}-detail`} className="bg-surface"><td colSpan={10} className="p-3">
        <div className="mb-3 flex justify-end"><button className={button} onClick={() => downloadDetail(batch)}><Download size={16} />Descargar detalle</button></div>
        <table className="w-full text-left text-xs"><thead><tr>{["Fila", "Estudiante", "Correo", "Salón", "Resultado"].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{detail.map((row) => <tr key={row.fila} className="border-t border-line"><td className="p-2">{row.fila}</td><td className="p-2">{row.nombre}<small className="block text-muted">DNI {row.dni}</small></td><td className="p-2">{row.correo}</td><td className="p-2">{row.salon}</td><td className="p-2"><strong className={row.estado === "error" ? "text-red-800" : "text-brand-900"}>{row.estado === "done" ? (row.cuenta_nueva ? "Cuenta nueva" : "Cuenta existente") : "Error"}</strong><small className="block">{row.mensaje}</small></td></tr>)}</tbody></table>
      </td></tr> : null];
    })}</tbody></table></div></section>;
}

export default function StudentAccess() {
  const [tab, setTab] = useState("students");
  const tabClass = (value) => `${button} ${tab === value ? "!bg-brand-900 !text-white" : ""}`;
  return <section className="mx-auto max-w-[1240px] space-y-5 pb-10">
    <PageHeading title="Accesos de estudiantes" description="Correos de acceso, ingresos al portal, restablecimiento de claves e historial de cargas." />
    <div className="flex flex-wrap gap-3" role="tablist"><button role="tab" aria-selected={tab === "students"} className={tabClass("students")} onClick={() => setTab("students")}><KeyRound size={16} />Estudiantes y claves</button><button role="tab" aria-selected={tab === "history"} className={tabClass("history")} onClick={() => setTab("history")}><History size={16} />Historial de cargas</button></div>
    {tab === "students" ? <Students /> : <ImportHistory />}
  </section>;
}
