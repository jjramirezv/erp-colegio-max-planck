import {
  ArrowLeft, ArrowRight, BookOpen, Check, FileText, GraduationCap, LoaderCircle, Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EMPTY_ARRAY, TEACHER_ROLES } from "../constants";
import { normalizedRole, selectionDetails, statusKey } from "../utils";
import { Dialog } from "./Dialog";

const FIELD_LABEL_CLASS = "text-[11px] font-extrabold text-[#26332e]";
const FIELD_INPUT_CLASS =
  "h-[48px] w-full min-w-0 rounded-[6px] border border-line-strong bg-white px-[13px] text-[13px] font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-[#949d99] focus:border-brand-800 focus:shadow-[0_0_0_3px_rgba(4,120,87,0.10)] disabled:bg-[#f1f4f3]";
const BUTTON_CLASS =
  "inline-flex min-h-[43px] items-center justify-center gap-2 rounded-[6px] border px-5 text-[11px] font-extrabold transition enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700/30";

const STEPS = [
  { id: 1, label: "Información", icon: FileText },
  { id: 2, label: "Destino", icon: GraduationCap },
  { id: 3, label: "Archivo", icon: Upload },
  { id: 4, label: "Confirmar", icon: Check },
];

function Stepper({ current, onBackTo }) {
  return (
    <ol className="grid grid-cols-4 border-b border-line bg-[#fbfcfb] px-4 py-4 sm:px-7" aria-label="Progreso del formulario">
      {STEPS.map((item, index) => {
        const complete = item.id < current;
        const active = item.id === current;
        const Icon = item.icon;
        return (
          <li key={item.id} className="relative grid justify-items-center gap-2">
            {index ? <span className={`absolute right-1/2 top-[17px] h-[2px] w-full ${item.id <= current ? "bg-brand-700" : "bg-[#dce5e1]"}`} aria-hidden="true" /> : null}
            <button type="button" disabled={!complete} onClick={() => complete && onBackTo(item.id)} aria-current={active ? "step" : undefined} className={`relative z-[1] grid h-9 w-9 place-items-center rounded-full border-2 text-[11px] font-black transition ${complete ? "border-brand-800 bg-brand-800 text-white hover:bg-brand-950" : active ? "border-brand-800 bg-white text-brand-800 shadow-[0_0_0_4px_#e8f5f0]" : "border-[#d5dfdb] bg-[#f2f5f4] text-[#87938e]"}`}>
              {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </button>
            <span className={`text-center text-[9px] font-extrabold sm:text-[10px] ${active || complete ? "text-brand-900" : "text-[#89938f]"}`}>{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function FieldError({ children }) {
  return <p className="m-0 text-[10px] font-bold text-[#a72b2b]" role="alert">{children}</p>;
}

export function MaterialFormDialog({ mode, material, structure, years, selection, role, busy, submitError, onClose, onSubmit }) {
  const isTeacher = TEACHER_ROLES.has(normalizedRole(role));
  const initial = material || {};
  const initialStatus = statusKey(initial.status);
  const scopeLocked = mode === "edit" && (
    initial.db?.hasPublishedRelease ||
    (initial.db?.releaseStatus && initial.db.releaseStatus !== "draft") ||
    initialStatus === "published" ||
    initialStatus === "archived"
  );
  const canReplaceFile = mode === "create" || !initial.db || initial.db.releaseStatus === "draft";
  const statusOptions = initialStatus === "published"
    ? ["Publicado", "Archivado"]
    : initialStatus === "archived"
      ? ["Archivado"]
      : ["Borrador", ...(!isTeacher ? ["Publicado"] : []), ...(mode === "edit" ? ["Archivado"] : [])];
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => ({
    title: initial.title || "",
    description: initial.description || "",
    year: String(initial.year || selection.year),
    levelId: initial.levelId || selection.levelId,
    gradeId: initial.gradeId || selection.gradeId,
    sectionId: initial.sectionId || selection.sectionId,
    courseId: initial.courseId || selection.courseId,
    origin: isTeacher ? "Docente" : initial.origin || "Institucional",
    delivery: initial.delivery || "Digital",
    fileType: initial.fileType || "PDF",
    status: initial.status || "Borrador",
  }));
  const [file, setFile] = useState(null);
  const details = selectionDetails(structure, form);
  const destination = useMemo(() => [form.year, details.level?.name, details.grade?.name, details.section?.name ? `Sección ${details.section.name}` : "", details.course?.name].filter(Boolean), [details, form.year]);

  function updateScope(field, value) {
    setError("");
    if (field === "levelId") {
      const level = structure.find((item) => item.id === value);
      const grade = level?.grades?.[0];
      const section = grade?.sections?.[0];
      setForm((current) => ({ ...current, levelId: value, gradeId: grade?.id || "", sectionId: section?.id || "", courseId: isTeacher ? "" : section?.courses?.[0]?.id || "" }));
      return;
    }
    if (field === "gradeId") {
      const grade = details.level?.grades?.find((item) => item.id === value);
      const section = grade?.sections?.[0];
      setForm((current) => ({ ...current, gradeId: value, sectionId: section?.id || "", courseId: isTeacher ? "" : section?.courses?.[0]?.id || "" }));
      return;
    }
    if (field === "sectionId") {
      const section = details.grade?.sections?.find((item) => item.id === value);
      setForm((current) => ({ ...current, sectionId: value, courseId: isTeacher ? "" : section?.courses?.[0]?.id || "" }));
      return;
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validate(targetStep = step) {
    if (targetStep === 1 && !form.title.trim()) return "Escribe el nombre del material para continuar.";
    if (targetStep === 2 && (!form.year || !form.levelId || !form.gradeId || !form.sectionId || !form.courseId || !details.course)) return "Selecciona el destino académico completo.";
    if (targetStep === 3 && form.delivery !== "Físico" && canReplaceFile && (mode === "create" || !initial.db?.versionId) && !file) return "Selecciona el archivo que se publicará.";
    return "";
  }

  function nextStep() {
    const message = validate();
    if (message) { setError(message); return; }
    setError("");
    setStep((current) => Math.min(4, current + 1));
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(1, current - 1));
  }

  function submit(event) {
    event.preventDefault();
    // Solo guarda con un clic explícito en "Crear material"; Enter en pasos previos avanza de etapa.
    if (step < 4) { nextStep(); return; }
    if (event.nativeEvent?.submitter?.dataset.action !== "create") return;
    const firstInvalidStep = [1, 2, 3].find((item) => validate(item));
    if (firstInvalidStep) {
      setStep(firstInvalidStep);
      setError(validate(firstInvalidStep));
      return;
    }
    const resolved = selectionDetails(structure, form);
    onSubmit({
      ...form,
      year: String(form.year),
      level: resolved.level?.name || "",
      grade: resolved.grade?.name || "",
      section: resolved.section?.name || "",
      course: resolved.course?.name || "",
      file: form.delivery === "Físico" ? null : file,
      fileSize: form.delivery !== "Físico" && file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : initial.fileSize,
    });
  }

  return (
    <Dialog title={mode === "edit" ? "Editar material" : "Nuevo material"} description={mode === "edit" ? "Actualiza el recurso paso a paso." : "Completa una etapa a la vez para registrar el recurso correctamente."} onClose={onClose} wide>
      <Stepper current={step} onBackTo={(target) => { setError(""); setStep(target); }} />
      <form onSubmit={submit}>
        <div className="min-h-[360px] px-5 py-6 sm:px-8 sm:py-7">
          {step === 1 ? <InformationStep form={form} setForm={setForm} error={error} clearError={() => setError("")} /> : null}
          {step === 2 ? <DestinationStep form={form} details={details} structure={structure} years={years} scopeLocked={scopeLocked} updateScope={updateScope} /> : null}
          {step === 3 ? <FileStep form={form} setForm={setForm} file={file} setFile={setFile} mode={mode} isTeacher={isTeacher} scopeLocked={scopeLocked} canReplaceFile={canReplaceFile} clearError={() => setError("")} /> : null}
          {step === 4 ? <ReviewStep form={form} setForm={setForm} destination={destination} file={file} initial={initial} statusOptions={statusOptions} /> : null}
          {error ? <div className="mx-auto mt-5 max-w-[610px]"><FieldError>{error}</FieldError></div> : null}
          {submitError ? <div className="mx-auto mt-5 max-w-[610px]"><FieldError>{submitError}</FieldError></div> : null}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-line bg-[#fbfcfb] px-5 py-4 sm:px-8">
          <div>{step > 1 ? <button type="button" className={`${BUTTON_CLASS} border-line-strong bg-white text-ink hover:border-brand-800 hover:bg-brand-50`} onClick={previousStep} disabled={busy}><ArrowLeft className="h-4 w-4" />Atrás</button> : <button type="button" className={`${BUTTON_CLASS} border-transparent bg-transparent px-2 text-muted hover:text-ink`} onClick={onClose}>Cancelar</button>}</div>
          {step < 4 ? <button key="next" type="button" className={`${BUTTON_CLASS} border-brand-800 bg-brand-800 text-white hover:bg-brand-950`} onClick={nextStep}>Continuar<ArrowRight className="h-4 w-4" /></button> : <button key="create" type="submit" data-action="create" className={`${BUTTON_CLASS} border-brand-800 bg-brand-800 text-white hover:bg-brand-950`} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}{mode === "edit" ? "Guardar cambios" : "Crear material"}</button>}
        </footer>
      </form>
    </Dialog>
  );
}

function StepHeading({ id, title, description }) {
  return <div><h3 id={id} className="m-0 text-[20px] font-extrabold leading-tight tracking-[-0.025em] text-ink">{title}</h3><p className="mb-0 mt-1.5 text-[11px] leading-relaxed text-muted">{description}</p></div>;
}

function InformationStep({ form, setForm, error, clearError }) {
  return <section className="mx-auto grid max-w-[610px] gap-5" aria-labelledby="material-step-one">
    <StepHeading id="material-step-one" title="Información del material" description="Indica un nombre claro y una descripción breve." />
    <label className="grid gap-2"><span className={FIELD_LABEL_CLASS}>Nombre del material</span><input autoFocus maxLength={120} className={FIELD_INPUT_CLASS} value={form.title} onChange={(event) => { clearError(); setForm((current) => ({ ...current, title: event.target.value })); }} placeholder="Ej. Libro oficial de Matemática" aria-invalid={Boolean(error)} /></label>
    <label className="grid gap-2"><span className={FIELD_LABEL_CLASS}>Descripción breve <small className="font-normal text-muted">(opcional)</small></span><textarea rows="4" maxLength={320} className="min-h-[118px] w-full resize-none rounded-[6px] border border-line-strong bg-white px-[13px] py-3 text-[13px] leading-relaxed text-ink outline-none transition placeholder:text-[#949d99] focus:border-brand-800 focus:shadow-[0_0_0_3px_rgba(4,120,87,0.10)]" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="¿Para qué se utilizará este material?" /></label>
  </section>;
}

function DestinationStep({ form, details, structure, years, scopeLocked, updateScope }) {
  return <section className="mx-auto grid max-w-[610px] gap-5" aria-labelledby="material-step-two">
    <StepHeading id="material-step-two" title="Destino académico" description="Define exactamente qué salón y curso podrán visualizarlo." />
    {scopeLocked ? <div className="rounded-[6px] border border-[#d8c78c] bg-amber-soft p-3 text-[10px] text-amber-ink">El destino está protegido porque este material ya fue publicado.</div> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2"><span className={FIELD_LABEL_CLASS}>Año académico</span><select className={FIELD_INPUT_CLASS} value={form.year} disabled={scopeLocked} onChange={(event) => updateScope("year", event.target.value)}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <label className="grid gap-2"><span className={FIELD_LABEL_CLASS}>Nivel</span><select className={FIELD_INPUT_CLASS} value={form.levelId} disabled={scopeLocked} onChange={(event) => updateScope("levelId", event.target.value)}>{structure.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
      <label className="grid gap-2"><span className={FIELD_LABEL_CLASS}>Grado</span><select className={FIELD_INPUT_CLASS} value={form.gradeId} disabled={scopeLocked} onChange={(event) => updateScope("gradeId", event.target.value)}>{(details.level?.grades || EMPTY_ARRAY).map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
      <label className="grid gap-2"><span className={FIELD_LABEL_CLASS}>Sección</span><select className={FIELD_INPUT_CLASS} value={form.sectionId} disabled={scopeLocked} onChange={(event) => updateScope("sectionId", event.target.value)}>{(details.grade?.sections || EMPTY_ARRAY).map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
      <label className="grid gap-2 sm:col-span-2"><span className={FIELD_LABEL_CLASS}>Curso o espacio de materiales</span><select className={FIELD_INPUT_CLASS} value={form.courseId} disabled={scopeLocked} onChange={(event) => updateScope("courseId", event.target.value)}>{(details.section?.courses || EMPTY_ARRAY).map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
    </div>
  </section>;
}

function FileStep({ form, setForm, file, setFile, mode, isTeacher, scopeLocked, canReplaceFile, clearError }) {
  return <section className="mx-auto grid max-w-[610px] gap-5" aria-labelledby="material-step-three">
    <StepHeading id="material-step-three" title="Entrega y archivo" description="Selecciona cómo se entregará el recurso y adjunta el archivo cuando corresponda." />
    <label className="grid gap-2"><span className={FIELD_LABEL_CLASS}>Tipo de entrega</span><select className={FIELD_INPUT_CLASS} value={form.delivery} disabled={scopeLocked} onChange={(event) => { const delivery = event.target.value; clearError(); setForm((current) => ({ ...current, delivery })); if (delivery === "Físico") setFile(null); }}><option>Digital</option>{!isTeacher ? <option>Físico</option> : null}<option>Físico / Digital</option></select></label>
    {form.delivery !== "Físico" && canReplaceFile ? <label className={`relative grid min-h-[150px] cursor-pointer place-content-center justify-items-center gap-2 rounded-[8px] border-2 border-dashed p-6 text-center transition ${file ? "border-brand-700 bg-brand-50" : "border-[#9eb7ae] bg-[#fbfdfc] hover:border-brand-700 hover:bg-brand-50"}`}><input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(event) => { clearError(); setFile(event.target.files?.[0] || null); }} /><span className="grid h-11 w-11 place-items-center rounded-full bg-brand-100 text-brand-800">{file ? <Check className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</span><strong className="max-w-[440px] truncate text-[12px] text-brand-900">{file?.name || (mode === "edit" ? "Seleccionar un archivo nuevo" : "Seleccionar archivo")}</strong><small className="text-[10px] text-muted">PDF, Word o PowerPoint</small></label> : form.delivery === "Físico" ? <div className="flex min-h-[120px] items-center gap-4 rounded-[8px] border border-[#d8c78c] bg-amber-soft p-5 text-amber-ink"><BookOpen className="h-7 w-7 flex-none" /><div><strong className="block text-[12px]">Entrega física</strong><span className="mt-1 block text-[10px] leading-relaxed">No necesitas adjuntar un archivo digital.</span></div></div> : null}
  </section>;
}

function ReviewStep({ form, setForm, destination, file, initial, statusOptions }) {
  return <section className="mx-auto grid max-w-[610px] gap-5" aria-labelledby="material-step-four">
    <StepHeading id="material-step-four" title="Revisar y confirmar" description="Comprueba el destino antes de guardar." />
    <div className="overflow-hidden rounded-[8px] border border-line-strong bg-white"><div className="border-b border-line p-4"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-brand-800">Material</span><strong className="mt-1 block text-[16px] font-extrabold tracking-[-0.015em] text-ink">{form.title}</strong>{form.description ? <p className="mb-0 mt-1 text-[10px] leading-relaxed text-muted">{form.description}</p> : null}</div><dl className="grid gap-0 sm:grid-cols-2"><div className="border-b border-line p-4 sm:border-r"><dt className="text-[9px] font-bold text-muted">Destino</dt><dd className="mb-0 mt-1 text-[11px] font-bold text-ink">{destination.join(" · ")}</dd></div><div className="border-b border-line p-4"><dt className="text-[9px] font-bold text-muted">Entrega</dt><dd className="mb-0 mt-1 text-[11px] font-bold text-ink">{form.delivery}</dd></div><div className="p-4 sm:border-r"><dt className="text-[9px] font-bold text-muted">Archivo</dt><dd className="mb-0 mt-1 truncate text-[11px] font-bold text-ink">{form.delivery === "Físico" ? "No requerido" : file?.name || initial.title || "Archivo actual"}</dd></div><div className="p-4"><dt className="text-[9px] font-bold text-muted">Origen</dt><dd className="mb-0 mt-1 text-[11px] font-bold text-ink">{form.origin}</dd></div></dl></div>
    <fieldset className="grid gap-2"><legend className={`${FIELD_LABEL_CLASS} mb-2`}>¿Cómo deseas guardarlo?</legend>{statusOptions.map((status) => <label key={status} className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-[7px] border px-4 transition ${form.status === status ? "border-brand-800 bg-brand-50" : "border-line-strong bg-white hover:border-brand-700"}`}><input type="radio" name="material-status" value={status} checked={form.status === status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-4 w-4 accent-[#047857]" /><span><strong className="block text-[11px] text-ink">{status}</strong><small className="text-[9px] text-muted">{status === "Publicado" ? "Visible para el destino seleccionado." : status === "Archivado" ? "Se conservará únicamente en el historial." : "Podrás revisarlo antes de publicarlo."}</small></span></label>)}</fieldset>
  </section>;
}

export default MaterialFormDialog;
