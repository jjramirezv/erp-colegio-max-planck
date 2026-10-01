import { AlertCircle, Archive, Check, ExternalLink, FilePlus2, FileText, LoaderCircle, Package, Pencil, RefreshCw, Send, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import PageHeading from "../../components/PageHeading";
import { coursePalette } from "../student/portal/theme";
import { CARD, CourseBadge, Empty, Pill } from "../student/portal/ui";
import { MaterialFormDialog } from "./dialogs/MaterialFormDialog";
import { VersionDialog } from "./dialogs/VersionDialog";
import { formatShortDate, isPurelyPhysicalDelivery, statusKey } from "./utils";

const STATUS = {
  draft: { label: "Borrador", hint: "Solo tú lo ves", className: "bg-[#fff1cc] text-[#7a5200]" },
  published: { label: "Publicado", hint: "Visible para tus estudiantes", className: "bg-[#dcf5e6] text-[#146c43]" },
  archived: { label: "Archivado", hint: "Oculto", className: "bg-[#eef2f0] text-[#5b6a65]" },
};
const FILE_TONE = { PDF: "bg-[#ffe3dc] text-[#9c3218]", DOCX: "bg-[#dbe8ff] text-[#1d4d9c]", DOC: "bg-[#dbe8ff] text-[#1d4d9c]", PPTX: "bg-[#ffedba] text-[#7a5200]", XLSX: "bg-[#d6f2e1] text-[#146c43]" };
const ACTION = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-line-strong bg-white px-3 text-[12px] font-bold text-brand-900 transition hover:border-brand-800 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40";

// Materiales del docente: elige un curso, sube, publica y actualiza sus archivos.
export default function TeacherMaterials({ data, loading, error, onRetry, onCreate, onUpdate, onArchive, onPublish, onUploadVersion, onOpenMaterial }) {
  const year = String(data.defaultSelection?.year || data.years?.[0] || "");
  const courses = useMemo(() => data.academicStructure.flatMap((level) => (level.grades || []).flatMap((grade) => (grade.sections || []).flatMap((section) => (section.courses || []).map((course) => ({
    key: `${section.id}:${course.id}`,
    name: course.id === "section" ? "Materiales del aula" : course.name,
    classroom: `${level.name} · ${grade.name} ${section.name}`,
    selection: { year, levelId: level.id, gradeId: grade.id, sectionId: section.id, courseId: course.id },
  }))))), [data.academicStructure, year]);
  const palette = useMemo(() => coursePalette(courses.map((course) => course.name)), [courses]);
  const [selectedKey, setSelectedKey] = useState("");
  const [filter, setFilter] = useState("active");
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const course = courses.find((item) => item.key === selectedKey) || courses[0];
  const inCourse = (item, material) => item && material.sectionId === item.selection.sectionId && material.courseId === item.selection.courseId && String(material.year) === String(item.selection.year);
  const courseMaterials = data.materials.filter((material) => inCourse(course, material));
  const visible = courseMaterials.filter((material) => filter === "active" ? statusKey(material.status) !== "archived" : statusKey(material.status) === filter).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const count = (status, list = courseMaterials) => list.filter((material) => statusKey(material.status) === status).length;
  const allowed = (material, permission) => material.permissions?.[permission] === true;
  const canCreate = data.permissions?.canCreate === true && !loading && !error;

  async function run(kind, callback, payload, message) {
    setBusy(kind); setActionError("");
    try { await callback?.(payload); setNotice(message); setTimeout(() => setNotice(""), 3500); return true; }
    catch (failure) { setActionError(failure?.message || "No se pudo completar la acción. Inténtalo nuevamente."); return false; }
    finally { setBusy(""); }
  }
  async function submitForm(values) {
    const done = dialog.type === "edit"
      ? await run("update", onUpdate, { id: dialog.material.id, changes: { ...values, updatedAt: new Date().toISOString() }, material: dialog.material }, "Cambios guardados correctamente.")
      : await run("create", onCreate, { ...values, id: `material-${Date.now()}`, version: "1.0", updatedAt: new Date().toISOString() }, "Material creado correctamente.");
    if (done) setDialog(null);
  }
  async function submitVersion(values) {
    if (await run("version", onUploadVersion, { materialId: dialog.material.id, material: dialog.material, ...values }, "La nueva versión quedó registrada.")) setDialog(null);
  }
  function archive(material) {
    if (window.confirm(`¿Archivar "${material.title}"? Tus estudiantes dejarán de verlo; el historial se conserva.`)) run(`archive-${material.id}`, onArchive, { id: material.id, material }, "Material archivado.");
  }
  async function open(material) {
    setBusy(`open-${material.id}`); setActionError("");
    try { await onOpenMaterial?.(material); } catch (failure) { setActionError(failure?.message || "No se pudo abrir el archivo."); } finally { setBusy(""); }
  }

  return <section className="mx-auto max-w-[1240px] space-y-5 pb-14 text-ink" aria-busy={loading}>
    <PageHeading standard title="Materiales de clase" description="Elige un curso, sube tus archivos y publícalos cuando estén listos para tus estudiantes." />
    {error ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#efb0ad] bg-[#fff6f5] p-4 text-[13px] font-semibold text-[#8f2924]"><AlertCircle size={18} className="flex-none" /><span className="flex-1">{error}</span>{onRetry ? <button type="button" className={ACTION} onClick={onRetry}><RefreshCw size={15} />Volver a cargar materiales</button> : null}</div> : null}
    {actionError ? <div role="alert" className="flex items-center gap-3 rounded-[10px] border border-[#efb0ad] bg-[#fff6f5] p-4 text-[13px] font-semibold text-[#8f2924]"><AlertCircle size={18} />{actionError}</div> : null}
    {loading ? <div role="status" className="grid min-h-[260px] place-content-center justify-items-center gap-2 text-[13px] text-muted"><LoaderCircle className="h-7 w-7 animate-spin text-brand-900" />Cargando tus materiales…</div>
      : error ? null : !courses.length ? <Empty icon={FileText} title="Aún no tienes cursos disponibles">Dirección o Coordinación Académica debe asignarte un curso para que puedas subir materiales.</Empty> : <>
        <nav aria-label="Mis cursos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{courses.map((item) => {
          const tone = palette.get(item.name); const active = item.key === course.key; const list = data.materials.filter((material) => inCourse(item, material));
          return <button key={item.key} type="button" aria-pressed={active} onClick={() => { setSelectedKey(item.key); setFilter("active"); }} className={`${CARD} flex items-center gap-3 overflow-hidden p-4 text-left transition hover:border-brand-800 ${active ? "ring-2 ring-brand-800" : ""}`}>
            <CourseBadge name={item.name} tone={tone} />
            <span className="min-w-0 flex-1"><strong className="block truncate text-[15px] text-brand-950">{item.name}</strong><small className="block truncate text-[12px] text-muted">{item.classroom}</small></span>
            <span className="text-right text-[11px] font-bold leading-5"><span className="block text-[#146c43]">{count("published", list)} publicados</span><span className="block text-[#8a6100]">{count("draft", list)} borradores</span></span>
          </button>;
        })}</nav>

        <section className={`${CARD} overflow-hidden`}>
          <header className={`flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 ${palette.get(course.name).soft}`}>
            <CourseBadge name={course.name} tone={palette.get(course.name)} />
            <div className="min-w-0 flex-1"><h2 className={`m-0 text-[18px] font-extrabold ${palette.get(course.name).text}`}>{course.name}</h2><p className="m-0 text-[13px] text-[#42524c]">{course.classroom}</p></div>
            <button type="button" disabled={!canCreate} onClick={() => { setActionError(""); setDialog({ type: "create" }); }} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-brand-900 px-5 text-[13px] font-bold text-white hover:bg-brand-800 disabled:opacity-40"><Upload size={17} />Subir material</button>
          </header>
          <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3" aria-label="Filtrar materiales">
            <Pill active={filter === "active"} onClick={() => setFilter("active")}>Todos · {courseMaterials.length - count("archived")}</Pill>
            <Pill active={filter === "published"} onClick={() => setFilter("published")}>Publicados · {count("published")}</Pill>
            <Pill active={filter === "draft"} onClick={() => setFilter("draft")}>Borradores · {count("draft")}</Pill>
            {count("archived") ? <Pill active={filter === "archived"} onClick={() => setFilter("archived")}>Archivados · {count("archived")}</Pill> : null}
          </div>
          <div className="p-5">{visible.length ? <div className="grid gap-4 md:grid-cols-2">{visible.map((material) => {
            const status = STATUS[statusKey(material.status)] || STATUS.draft; const type = String(material.fileType || "").toUpperCase(); const digital = Boolean(material.db?.storagePath);
            return <article key={material.id} className="flex flex-col gap-3 rounded-[10px] border border-line p-4">
              <div className="flex items-start gap-3">
                <span className={`grid h-12 w-11 flex-none place-content-center justify-items-center rounded-[8px] text-[10px] font-black ${digital ? FILE_TONE[type] || "bg-canvas text-brand-900" : "bg-canvas text-brand-900"}`}>{digital ? <FileText size={18} /> : <Package size={18} />}{digital ? type || "ARCH" : "FÍSICO"}</span>
                <div className="min-w-0 flex-1"><h3 className="m-0 text-[15px] font-extrabold leading-snug text-brand-950">{material.title}</h3><p className="mb-0 mt-1 line-clamp-2 text-[13px] text-[#52615c]">{material.description || "Sin descripción."}</p></div>
                <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-extrabold ${status.className}`} title={status.hint}>{status.label}</span>
              </div>
              <small className="text-[12px] text-muted">Versión {material.version} · {formatShortDate(material.updatedAt)} · {status.hint}</small>
              <div className="flex flex-wrap gap-2">
                {statusKey(material.status) === "draft" && allowed(material, "canPublish") ? <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-brand-900 px-4 text-[12px] font-bold text-white hover:bg-brand-800 disabled:opacity-40" disabled={Boolean(busy)} onClick={() => run(`publish-${material.id}`, onPublish, { id: material.id, material }, "Material publicado para tus estudiantes.")}>{busy === `publish-${material.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}Publicar</button> : null}
                {digital ? <button type="button" className={ACTION} disabled={Boolean(busy)} onClick={() => open(material)}>{busy === `open-${material.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <ExternalLink size={15} />}Abrir</button> : null}
                {statusKey(material.status) !== "archived" && allowed(material, "canEdit") ? <button type="button" className={ACTION} disabled={Boolean(busy)} onClick={() => { setActionError(""); setDialog({ type: "edit", material }); }}><Pencil size={15} />Editar</button> : null}
                {statusKey(material.status) !== "archived" && !isPurelyPhysicalDelivery(material.delivery) && allowed(material, "canUploadVersion") ? <button type="button" className={ACTION} disabled={Boolean(busy)} onClick={() => { setActionError(""); setDialog({ type: "version", material }); }}><FilePlus2 size={15} />Nueva versión</button> : null}
                {statusKey(material.status) !== "archived" && allowed(material, "canArchive") ? <button type="button" className={`${ACTION} ml-auto text-[#a1231f]`} disabled={Boolean(busy)} onClick={() => archive(material)} aria-label={`Archivar ${material.title}`}><Archive size={15} /></button> : null}
              </div>
            </article>;
          })}</div> : <Empty icon={FileText} title={courseMaterials.length ? "Nada en este filtro" : "Aún no hay materiales"}>{courseMaterials.length ? "Prueba con otro filtro." : "Pulsa “Subir material” para compartir tu primer archivo. Quedará como borrador hasta que lo publiques."}</Empty>}</div>
        </section>
      </>}
    <div className="pointer-events-none fixed bottom-4 right-4 z-[260]" role="status" aria-live="polite">{notice ? <span className="flex items-center gap-2 rounded-[8px] border border-[#99c9b5] bg-white px-4 py-3 text-[13px] font-bold text-brand-800 shadow-lg"><Check size={17} />{notice}</span> : null}</div>
    {dialog?.type === "create" || dialog?.type === "edit" ? <MaterialFormDialog mode={dialog.type} material={dialog.material} structure={data.academicStructure} years={data.years} selection={course.selection} role="docente" busy={busy === "create" || busy === "update"} submitError={actionError} onClose={() => setDialog(null)} onSubmit={submitForm} /> : null}
    {dialog?.type === "version" ? <VersionDialog material={dialog.material} busy={busy === "version"} onClose={() => setDialog(null)} onSubmit={submitVersion} /> : null}
  </section>;
}
