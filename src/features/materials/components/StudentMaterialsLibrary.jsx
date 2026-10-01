import { AlertCircle, BookOpen, ExternalLink, FileText, LoaderCircle, Package, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeading from "../../../components/PageHeading";
import { coursePalette } from "../../student/portal/theme";
import { CARD, CourseBadge, Empty, Pill } from "../../student/portal/ui";
import { formatShortDate } from "../utils";

const FILE_TONE = { PDF: "bg-[#ffe3dc] text-[#9c3218]", DOCX: "bg-[#dbe8ff] text-[#1d4d9c]", DOC: "bg-[#dbe8ff] text-[#1d4d9c]", PPTX: "bg-[#ffedba] text-[#7a5200]", XLSX: "bg-[#d6f2e1] text-[#146c43]" };

function Alert({ children }) {
  return <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-[#efb0ad] bg-[#fff6f5] p-4 text-[13px] font-semibold text-[#8f2924]"><AlertCircle className="mt-0.5 h-4 w-4 flex-none" />{children}</div>;
}

export function StudentMaterialsLibrary({ data, loading, error, remote, onOpenMaterial }) {
  const courses = useMemo(() => {
    const preferred = data.defaultSelection || {};
    const level = data.academicStructure.find((item) => String(item.id) === String(preferred.levelId)) || data.academicStructure[0];
    const grade = level?.grades?.find((item) => String(item.id) === String(preferred.gradeId)) || level?.grades?.[0];
    const section = grade?.sections?.find((item) => String(item.id) === String(preferred.sectionId)) || grade?.sections?.[0];
    return (section?.courses || []).map((course) => ({ ...course, level: level.name, grade: grade.name, section: section.name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [data.academicStructure, data.defaultSelection]);
  const palette = useMemo(() => coursePalette(courses.map((course) => course.name)), [courses]);
  const [courseId, setCourseId] = useState("all");
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState(null);
  const [openError, setOpenError] = useState("");
  const published = data.materials.filter((material) => material.status === "Publicado" && courses.some((course) => course.id === material.courseId));
  const normalized = query.trim().toLocaleLowerCase("es-PE");
  const visible = published.filter((material) => (courseId === "all" || material.courseId === courseId) && (!normalized || `${material.title} ${material.description || ""}`.toLocaleLowerCase("es-PE").includes(normalized)));
  const courseOf = (material) => courses.find((course) => course.id === material.courseId);

  useEffect(() => {
    if (courseId !== "all" && !courses.some((course) => course.id === courseId)) setCourseId("all");
  }, [courseId, courses]);

  async function openMaterial(material) {
    setOpenError("");
    if (!remote) { setOpenError("El visor real estará disponible al configurar la sesión de Supabase del ERP."); return; }
    setOpeningId(material.id);
    try { await onOpenMaterial(material); }
    catch (failure) { setOpenError(failure.message || "No se pudo abrir el material."); }
    finally { setOpeningId(null); }
  }

  return <section className="mx-auto max-w-[1240px] space-y-5 pb-10">
    <PageHeading standard title="Materiales" description="Libros, guías y recursos que tus docentes publicaron para tu sección." action={<span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white px-4 py-2 text-[12px] font-bold text-brand-900"><BookOpen className="h-4 w-4" />{published.length} disponibles</span>} />
    {error ? <Alert>{error}</Alert> : null}
    {openError ? <Alert>{openError}</Alert> : null}
    {loading ? <div role="status" className="grid min-h-[260px] place-content-center justify-items-center gap-2 text-[13px] text-muted"><LoaderCircle className="h-7 w-7 animate-spin text-brand-900 motion-reduce:animate-none" />Cargando tus materiales…</div>
      : !courses.length ? <Empty icon={BookOpen} title="No encontramos cursos asignados">Coordinación debe completar tu matrícula y sección del año vigente.</Empty> : <>
        <div className={`${CARD} space-y-4 p-4 md:p-5`}>
          <label className="flex min-h-11 items-center gap-2 rounded-[8px] border border-line-strong px-3 focus-within:border-brand-800"><Search className="h-4 w-4 text-muted" /><input aria-label="Buscar material" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] outline-none" placeholder="Buscar por título o descripción" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <nav aria-label="Cursos matriculados" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Pill active={courseId === "all"} onClick={() => setCourseId("all")}>Todos · {published.length}</Pill>
            {courses.map((course) => { const count = published.filter((material) => material.courseId === course.id).length; return <Pill key={course.id} active={courseId === course.id} onClick={() => setCourseId(course.id)}><i className={`h-2.5 w-2.5 rounded-full ${palette.get(course.name).bar}`} />{course.name} · {count}</Pill>; })}
          </nav>
        </div>
        {visible.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((material) => {
          const course = courseOf(material); const tone = palette.get(course?.name);
          const type = String(material.fileType || "").toUpperCase(); const digital = Boolean(material.db?.storagePath);
          return <article key={material.id} className={`${CARD} flex flex-col overflow-hidden`}>
            <div className={`flex items-center gap-3 px-5 py-4 ${tone?.soft || "bg-canvas"}`}>
              {course ? <CourseBadge name={course.name} tone={tone} size="h-9 w-9 text-[12px]" /> : null}
              <span className={`min-w-0 flex-1 truncate text-[12px] font-extrabold uppercase tracking-[0.03em] ${tone?.text || "text-brand-900"}`}>{course?.name}</span>
              <span className={`rounded-[6px] px-2 py-1 text-[10px] font-black ${FILE_TONE[type] || "bg-white text-brand-900"}`}>{digital ? type || "ARCHIVO" : "FÍSICO"}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <h2 className="m-0 flex items-start gap-2 text-[16px] font-extrabold leading-snug text-brand-950">{digital ? <FileText className="mt-0.5 h-4 w-4 flex-none text-muted" /> : <Package className="mt-0.5 h-4 w-4 flex-none text-muted" />}{material.title}</h2>
              <p className="m-0 line-clamp-3 text-[13px] leading-relaxed text-[#52615c]">{material.description || "Material de consulta del curso."}</p>
              <small className="text-[12px] text-muted">{material.origin} · Versión {material.version} · {formatShortDate(material.updatedAt)}</small>
              <button type="button" className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-brand-900 px-4 text-[13px] font-bold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-[#c9d5d0]" onClick={() => openMaterial(material)} disabled={openingId === material.id || !digital}>
                {openingId === material.id ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <ExternalLink className="h-4 w-4" />}
                {digital ? "Abrir material" : "Entrega física en el aula"}
              </button>
            </div>
          </article>;
        })}</div> : <Empty icon={BookOpen} title={published.length ? "Sin coincidencias" : "Aún no hay materiales publicados"}>{published.length ? "Prueba con otro curso o palabra de búsqueda." : "Cuando tu docente o Coordinación publique un recurso, aparecerá aquí."}</Empty>}
      </>}
  </section>;
}

export default StudentMaterialsLibrary;
