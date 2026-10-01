import { useEffect, useRef, useState } from "react";
import { Download, Upload, UsersRound } from "lucide-react";
import PageHeading from "../../components/PageHeading";
import { GUARDIAN_HEADERS, HEADERS, downloadCSV, parseCSV, prepareRows } from "./csv";
import { loadImportCatalog, processBatch, startImport } from "./importApi";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-brand-900 disabled:cursor-not-allowed disabled:opacity-40";
const labels = { invalid: "Corregir archivo", pending: "Sin revisar", ready: "Listo para importar", done: "Completado", error: "Revisar / reintentar" };
export default function StudentImport() {
  const [catalog, setCatalog] = useState(null);
  const [yearId, setYearId] = useState("");
  const [destinationMode, setDestinationMode] = useState("single");
  const [level, setLevel] = useState("");
  const [grade, setGrade] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("all");
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const stop = useRef(false);
  const lock = useRef(false);
  const fileInput = useRef(null);
  const batchId = useRef(null);
  const fileName = useRef("");
  const unsaved = rows.some((row) => row.accountCreated || row.parentCreated) && !credentialsSaved;
  async function refresh() {
    setError("");
    try { const result = await loadImportCatalog(); setCatalog(result); setYearId(String(result.years[0]?.id || "")); }
    catch (failure) { setError(failure.message); }
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const guard = (event) => {
      if (busy) { event.preventDefault(); return; }
      if (unsaved && !window.confirm("Hay credenciales nuevas sin descargar. ¿Salir de esta pantalla?")) event.preventDefault();
    };
    const unload = (event) => { if (busy || unsaved) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("mp-before-navigation", guard);
    window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("mp-before-navigation", guard); window.removeEventListener("beforeunload", unload); };
  }, [busy, unsaved]);
  useEffect(() => () => { stop.current = true; }, []);
  async function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); setProgress("");
    try {
      if (destinationMode === "single" && !destination) throw new Error("Selecciona primero el nivel, grado y sección.");
      if (!/\.csv$/i.test(file.name)) throw new Error("En Excel, guarda el archivo como CSV UTF-8 (.csv). No se admite .xlsx directamente.");
      if (file.size > 5 * 1024 * 1024) throw new Error("El archivo debe pesar menos de 5 MB.");
      fileName.current = file.name;
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      const records = parseCSV(text, { classroomInFile: destinationMode === "multiple" });
      const assigned = destinationMode === "single" ? records.map((row) => ({ ...row, nivel: destination.level, grado: destination.grade, seccion: destination.section })) : records;
      setRows(prepareRows(assigned, catalog.sections, yearId)); batchId.current = null; setPage(0); setFilter("all"); setCredentialsSaved(false);
    } catch (failure) { setRows([]); setError(failure.message); }
  }
  async function run(action) {
    if (lock.current) return;
    const selected = rows.filter((row) => action === "validar" ? ["pending", "error"].includes(row.status) : row.status === "ready");
    if (!selected.length) return;
    lock.current = true; stop.current = false; setBusy(true); setError("");
    const size = action === "importar" ? 10 : 50;
    let processed = 0;
    let working = rows;
    try {
      // Cada archivo queda registrado una sola vez en el historial de cargas.
      if (action === "importar" && !batchId.current) batchId.current = await startImport({ yearId, sectionId: destinationMode === "single" ? destination?.id : null, file: fileName.current, total: rows.length });
      for (let start = 0; start < selected.length; start += size) {
        if (stop.current) break;
        const batch = selected.slice(start, start + size);
        setProgress(`${action === "importar" ? "Importando" : "Revisando"}: ${processed} de ${selected.length}`);
        const results = await processBatch(action, yearId, batch, batchId.current);
        const byRow = new Map(results.map((result) => [result.row, result]));
        working = working.map((row) => {
          const result = byRow.get(row.row);
          return result ? { ...row, ...result, accountCreated: Boolean(row.accountCreated || result.accountCreated), parentCreated: Boolean(row.parentCreated || result.parentCreated), message: result.message || (result.existing ? "Cuenta existente: conserva su contraseña. Si no la recuerda, genera una nueva en Accesos de estudiantes." : "Revisado. Aún no se crea: pulsa Importar.") } : row;
        });
        setRows(working);
        if (results.some((result) => result.accountCreated || result.parentCreated)) setCredentialsSaved(false);
        processed += batch.length;
      }
      setProgress(`${stop.current ? "Pausado" : "Proceso terminado"}: ${processed} de ${selected.length} filas revisadas. Consulta el resultado de cada fila.${action === "importar" ? " La carga quedó registrada en Accesos de estudiantes → Historial de cargas." : ""}`);
      // Descarga automática: evita perder las claves generadas al salir de la pantalla.
      if (action === "importar" && working.some((row) => row.accountCreated || row.parentCreated)) downloadCredentials(working);
    } catch (failure) { setError(failure.message); setProgress(`Proceso detenido tras ${processed} filas. Puedes continuar con las pendientes.`); }
    finally { setBusy(false); lock.current = false; }
  }
  const invalid = rows.filter((row) => row.status === "invalid").length;
  const ready = rows.filter((row) => row.status === "ready").length;
  const done = rows.filter((row) => row.status === "done").length;
  const review = rows.filter((row) => ["pending", "error"].includes(row.status)).length;
  const filtered = rows.filter((row) => filter === "all" || (filter === "errors" ? ["invalid", "error"].includes(row.status) : row.status === filter));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const sections = catalog?.sections.filter((item) => String(item.yearId) === yearId) || [];
  const levels = [...new Set(sections.map((item) => item.level))];
  const grades = [...new Set(sections.filter((item) => item.level === level).map((item) => item.grade))];
  const classroomOptions = sections.filter((item) => item.level === level && item.grade === grade);
  const destination = classroomOptions.find((item) => String(item.id) === sectionId);
  const destinationReady = Boolean(yearId && sections.length && (destinationMode === "multiple" || destination));
  const destinationLocked = busy || rows.length > 0;
  function downloadResults() {
    downloadCSV("resultado-estudiantes.csv", [["fila", "dni", "nombre", "correo", "nivel", "grado", "seccion", "estado", "detalle"], ...rows.map((row) => [row.row, row.dni, row.name, row.email, row.level, row.grade, row.section, labels[row.status], row.message])]);
  }
  function downloadCredentials(source = rows) {
    const portal = `${window.location.origin}${window.location.pathname}`;
    // Una fila por estudiante con su acceso y, si corresponde, el acceso de su familia.
    downloadCSV("credenciales-estudiantes.csv", [["dni", "nombre", "correo", "clave", "matricula", "apoderado", "correo_familia", "clave_familia", "portal"], ...source.filter((row) => row.accountCreated || row.parentCreated).map((row) => [row.dni, row.name, row.email, row.accountCreated ? row.password : "(conserva su clave)", row.status === "done" ? "Matriculado" : "Revisar matrícula", row.parentName || "", row.parentEmail || "", row.parentCreated ? row.parentDni : row.parentEmail ? "(cuenta existente)" : "", portal])]);
    setCredentialsSaved(true);
  }
  return <section className="mx-auto max-w-[1240px] space-y-5 pb-10">
    <PageHeading title="Importar estudiantes" description="Carga hasta 3000 estudiantes con sus accesos y matrícula desde un CSV de Excel." />
    <div className="rounded-lg bg-brand-50 p-5 text-sm leading-6 text-brand-900"><strong>Dirección y Coordinación Académica</strong> pueden realizar esta carga. Los grados y salones deben estar creados. La matrícula vincula al estudiante con los cursos de su sección y con las listas de sus docentes.</div>
    {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}{!catalog ? <button className={`${button} ml-3`} onClick={refresh}>Reintentar</button> : null}</div> : null}
    {!catalog ? <p role="status">{error ? "No se pudo cargar la configuración." : "Cargando años y salones…"}</p> : <>
      <section className="space-y-4 rounded-lg border border-line bg-white p-5">
        <h2 className="m-0 text-lg font-bold">1. Elige dónde matricularlos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2 text-sm font-semibold">Año lectivo<select aria-label="Año lectivo" className={`${button} w-full min-w-0`} value={yearId} disabled={destinationLocked} onChange={(event) => { setYearId(event.target.value); setLevel(""); setGrade(""); setSectionId(""); }}>{catalog.years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold">Destino de la carga<select aria-label="Destino de la carga" className={`${button} w-full min-w-0`} value={destinationMode} disabled={destinationLocked} onChange={(event) => setDestinationMode(event.target.value)}><option value="single">Una sección</option><option value="multiple">Varias secciones desde el archivo</option></select></label>
        </div>
        {destinationMode === "single" ? <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid min-w-0 gap-2 text-sm font-semibold">Nivel educativo<select aria-label="Nivel educativo" className={`${button} w-full min-w-0`} value={level} disabled={destinationLocked || !levels.length} onChange={(event) => { setLevel(event.target.value); setGrade(""); setSectionId(""); }}><option value="">Selecciona un nivel</option>{levels.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold">Grado<select aria-label="Grado" className={`${button} w-full min-w-0`} value={grade} disabled={destinationLocked || !level} onChange={(event) => { setGrade(event.target.value); setSectionId(""); }}><option value="">Selecciona un grado</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold">Sección<select aria-label="Sección" className={`${button} w-full min-w-0`} value={sectionId} disabled={destinationLocked || !grade} onChange={(event) => setSectionId(event.target.value)}><option value="">Selecciona una sección</option>{classroomOptions.map((item) => <option key={item.id} value={item.id}>{item.section}</option>)}</select></label>
        </div> : <p className="text-sm text-muted">Cada fila del archivo indicará su nivel, grado y sección dentro del año elegido.</p>}
        {destinationMode === "single" && destination ? <p className="rounded-md bg-brand-50 p-4 text-sm text-brand-900"><strong>Salón de destino: {destination.level} · {destination.grade} · Sección {destination.section}.</strong> Todos los estudiantes del archivo se asignarán aquí. Esta selección se aplicará también si el CSV incluye columnas de nivel, grado y sección.</p> : null}
        {!yearId || !sections.length ? <p className="text-sm text-muted">Primero configura un año abierto con grados y secciones activas.</p> : null}
      </section>
      <section className="space-y-4 rounded-lg border border-line bg-white p-5">
        <h2 className="m-0 text-lg font-bold">2. Carga el archivo de estudiantes</h2>
        {!destinationReady ? <p className="text-sm text-muted">Completa primero el destino de la matrícula para habilitar la carga.</p> : null}
        <p className="text-sm leading-6 text-muted">Completa <strong>{destinationMode === "single" ? "DNI, nombres y apellidos" : "DNI, nombres, apellidos, nivel, grado y sección"}</strong>. Correo y clave son opcionales: si están vacíos, el correo será DNI@estudiantes.maxplanck.edu.pe y la clave será el DNI. Ese correo identifica la cuenta; no crea un buzón de correo. Para cuentas existentes usa su correo actual: su contraseña no se cambia.</p>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={!destinationReady} onClick={() => downloadCSV("plantilla-estudiantes.csv", [destinationMode === "single" ? [...HEADERS.slice(0, 5), ...GUARDIAN_HEADERS] : [...HEADERS, ...GUARDIAN_HEADERS]])}><Download size={16} />Descargar plantilla</button>{destinationMode === "multiple" ? <button className={button} disabled={!sections.length} onClick={() => downloadCSV("salones-disponibles.csv", [["nivel", "grado", "seccion", "capacidad"], ...sections.map((s) => [s.level, s.grade, s.section, s.capacity])])}>Descargar nombres de salones</button> : null}</div>
        <p className="text-xs text-muted">En Excel: importa el DNI como texto para conservar ceros iniciales. Guarda como CSV UTF-8. Si dejas la clave vacía, la clave será el DNI del estudiante.</p>
        <p className="rounded-md bg-brand-50 p-4 text-sm leading-6 text-brand-900"><strong>Acceso para padres (opcional):</strong> completa <code>dni_apoderado</code>, <code>nombre_apoderado</code> y <code>parentesco</code> (madre, padre, apoderado u otro). Se crea una cuenta de familia con correo <strong>DNI@familias.maxplanck.edu.pe</strong> y clave igual a su DNI. Si dos hermanos tienen el mismo DNI de apoderado, comparten una sola cuenta y el padre ve a ambos.</p>
        <label className="grid gap-2 text-sm font-semibold">Archivo de estudiantes<input ref={fileInput} type="file" accept=".csv,text/csv" disabled={busy || !destinationReady || rows.length > 0} onChange={readFile} className="block w-full min-w-0 text-sm file:mr-3 file:rounded file:border-0 file:bg-brand-50 file:p-3 file:text-brand-900" /></label>
      </section>
      {rows.length ? <>
        <section className="space-y-4 rounded-lg border border-line bg-white p-5">
          <h2 className="m-0 text-lg font-bold">3. Revisa e importa</h2>
          <div className="flex flex-wrap gap-4 text-sm"><span>{rows.length} estudiantes</span><span>{ready} listos</span><span>{done} completados</span><span>{invalid} por corregir en el archivo</span></div>
          <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || !review || invalid > 0} onClick={() => run("validar")}>Revisar datos y duplicados</button><button className={`${button} !bg-brand-900 !text-white`} disabled={busy || !ready || invalid > 0 || review > 0} onClick={() => run("importar")}><Upload size={16} />Importar {ready} estudiantes</button>{busy ? <button className={button} onClick={() => { stop.current = true; setProgress("Se pausará al terminar el lote actual…"); }}>Pausar después de este lote</button> : <button className={button} onClick={() => { if (unsaved && !window.confirm("Aún no descargaste las credenciales nuevas. ¿Descartar este resultado?")) return; setRows([]); batchId.current = null; setProgress(""); setCredentialsSaved(false); if (fileInput.current) fileInput.current.value = ""; }}>Cargar otro archivo</button>}</div>
          {invalid ? <p className="text-sm text-red-800">Corrige las filas indicadas y vuelve a cargar el archivo antes de continuar.</p> : null}
          {progress ? <p role="status" className="text-sm text-brand-900">{progress}</p> : null}
          <p className="text-xs text-muted">Mantén esta pestaña abierta durante el proceso. Puedes pausar entre lotes. Las cuentas existentes mantienen sus credenciales y las matrículas existentes no se duplican.</p>
        </section>
        <section className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4"><label className="text-sm">Mostrar <select aria-label="Filtrar resultados" className={button} value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0); }}><option value="all">Todas las filas</option><option value="errors">Errores</option><option value="done">Completadas</option><option value="ready">Listas</option></select></label><span className="text-xs text-muted">Página {currentPage + 1} de {pageCount}</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-brand-50"><tr>{["Fila", "Estudiante", "Acceso", "Salón", "Resultado"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{filtered.slice(currentPage * 50, currentPage * 50 + 50).map((row) => <tr key={row.row} className="border-t border-line"><td className="p-3">{row.row}</td><td className="p-3"><strong>{row.name}</strong><small className="block text-muted">DNI {row.dni}</small></td><td className="max-w-[230px] break-words p-3">{row.email}{row.parentEmail ? <small className="block text-muted">Familia: {row.parentEmail}</small> : null}</td><td className="p-3">{row.level} · {row.grade} {row.section}</td><td className="max-w-[280px] p-3"><strong className={["error", "invalid"].includes(row.status) ? "text-red-800" : "text-brand-900"}>{labels[row.status]}</strong><small className="block">{row.message}</small></td></tr>)}</tbody></table></div>
          <div className="flex justify-end gap-3 p-3"><button className={button} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><button className={button} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</button></div>
        </section>
        {ready && !busy ? <section role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-brand-900 bg-brand-50 p-5"><p className="m-0 text-sm text-brand-900"><strong>{ready} estudiante(s) revisados.</strong> Todavía no tienen cuenta: pulsa Importar para crear sus accesos y matrícula. Las credenciales se descargarán automáticamente.</p><button className={`${button} !bg-brand-900 !text-white`} disabled={invalid > 0 || review > 0} onClick={() => run("importar")}><Upload size={16} />Importar {ready} estudiantes</button></section> : null}
        <section className="space-y-3 rounded-lg border border-line bg-white p-5"><h2 className="m-0 text-lg font-bold">4. Descarga el resultado</h2><p className="text-sm text-muted">Entrega a cada estudiante únicamente su correo y clave. Las claves nuevas solo se conservan en esta pantalla hasta salir; no se guardan en el navegador.</p><div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={downloadResults}><Download size={16} />Descargar resultados</button><button className={button} disabled={busy || !rows.some((row) => row.accountCreated || row.parentCreated)} onClick={() => downloadCredentials()}><UsersRound size={16} />Descargar credenciales nuevas</button></div></section>
      </> : null}
    </>}
  </section>;
}
